import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { ContractError, assertUuid } from '../../packages/domain/src/identity.js';
import { assetVersionSchema, voiceSchema, characterSchema, mediaRequirementSchema } from '../../packages/activity-schemas/src/media.js';
import type { AssetStore, MediaReference } from '../../packages/application/src/media.js';
import { transaction } from './database.js';

/** P5 ingestion/preflight service. P8 owns Admin screens and generation-provider orchestration. */
export class MediaRepository {
  constructor(private readonly pool:pg.Pool,private readonly store:AssetStore) {}
  private async language(code:string):Promise<string> {
    const row=(await this.pool.query('SELECT id FROM languages WHERE stable_code=$1',[code])).rows[0];
    if(!row)throw new ContractError('INVALID_INPUT','Unknown media language');
    return row.id as string;
  }
  async registerVoice(actorId:string,input:unknown):Promise<void> {
    assertUuid(actorId);const v=voiceSchema.parse(input),languageId=await this.language(v.scope.language);
    await this.pool.query(`INSERT INTO voices(id,version_code,language_id,stable_code,variety,metadata,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[v.id,v.version_code,languageId,v.stable_code,v.scope.variety,v,actorId]);
  }
  async registerCharacter(actorId:string,input:unknown):Promise<void> {
    assertUuid(actorId);const c=characterSchema.parse(input),languageId=await this.language(c.scope.language);
    await this.pool.query(`INSERT INTO characters(id,version_code,language_id,stable_code,variety,voice_id,voice_version_code,metadata,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[c.id,c.version_code,languageId,c.stable_code,c.scope.variety,c.voice_id,c.voice_version_code,c,actorId]);
  }
  async declareRequirement(actorId:string,input:unknown):Promise<void> {
    assertUuid(actorId);const r=mediaRequirementSchema.parse(input),languageId=await this.language(r.scope.language);
    await this.pool.query(`INSERT INTO media_requirements(id,target_content_version_id,item_id,language_id,role,required,kind,variety,specification_version,specification,accessibility_role,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[r.id,r.target_content_version_id,r.item_id,languageId,r.role,r.required,r.kind,r.scope.variety,r.specification_version,r.specification,r.accessibility_role,actorId]);
  }
  async enqueue(actorId:string,requirementId:string,idempotencyKey:string,adapterCode:string,generatorVersion:string):Promise<string> {
    for(const v of [actorId,requirementId,idempotencyKey])assertUuid(v);
    if(!/^[A-Za-z0-9_-]{1,80}$/u.test(adapterCode)||!generatorVersion||generatorVersion.length>80)throw new ContractError('INVALID_INPUT','Versioned generation adapter required');
    return transaction(this.pool,async db=>{
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`media:${actorId}:${idempotencyKey}`]);
      const hash=(await db.query('SELECT p2_json_checksum($1::jsonb) AS hash',[{requirementId,adapterCode,generatorVersion}])).rows[0]?.hash as string;
      const prior=(await db.query('SELECT id,request_hash FROM media_jobs WHERE created_by=$1 AND idempotency_key=$2',[actorId,idempotencyKey])).rows[0];
      if(prior){if(prior.request_hash!==hash)throw new ContractError('CONFLICT','Media idempotency key reused for another request');return prior.id as string;}
      const req=(await db.query('SELECT language_id FROM media_requirements WHERE id=$1',[requirementId])).rows[0];
      if(!req)throw new ContractError('NOT_FOUND','Media requirement not found');
      const id=randomUUID();
      await db.query(`INSERT INTO media_jobs(id,requirement_id,language_id,idempotency_key,request_hash,provider_adapter_code,generator_version,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[id,requirementId,req.language_id,idempotencyKey,hash,adapterCode,generatorVersion,actorId]);
      return id;
    });
  }
  async ingest(actorId:string,jobId:string,input:unknown,bytes:Uint8Array):Promise<{asset_id:string;asset_version:number;checksum:string;metadata_checksum:string}> {
    assertUuid(actorId);assertUuid(jobId);const a=assetVersionSchema.parse(input);
    if(bytes.byteLength!==a.byte_length)throw new ContractError('INVALID_INPUT','Asset byte length differs from manifest');
    const languageId=await this.language(a.scope.language),key=`assets/${a.asset_id}/${a.asset_version}/${a.checksum}`;
    return transaction(this.pool,async db=>{
      const job=(await db.query('SELECT * FROM media_jobs WHERE id=$1 FOR UPDATE',[jobId])).rows[0];
      if(!job||job.created_by!==actorId||job.language_id!==languageId)throw new ContractError('NOT_FOUND','Media job not owned by author/language');
      // Replay must match the immutable request/output. A retry never overwrites bytes or metadata.
      const prior=(await db.query('SELECT asset_id,version AS asset_version,checksum,metadata_checksum,metadata FROM asset_versions WHERE job_id=$1',[jobId])).rows;
      if(job.state==='succeeded') {
        const p=prior[0];const same=(await db.query('SELECT p2_json_checksum($1::jsonb) AS hash',[a])).rows[0]?.hash;
        if(prior.length!==1||!p||p.metadata_checksum!==same)throw new ContractError('CONFLICT','Media job output is immutable');
        await this.store.readVerified(key,a.checksum,a.byte_length);
        return {asset_id:p.asset_id as string,asset_version:p.asset_version as number,checksum:p.checksum as string,metadata_checksum:p.metadata_checksum as string};
      }
      if(job.state!=='queued'||job.attempts>=3)throw new ContractError('CONFLICT','Media job is not eligible for ingestion');
      if(job.generator_version!==a.rights.generator_version)throw new ContractError('INVALID_INPUT','Generator provenance differs from queued job');
      await db.query("UPDATE media_jobs SET state='processing',attempts=attempts+1 WHERE id=$1",[jobId]);
      // Conditional immutable upload is safe if the following DB transaction fails: retry verifies the same bytes.
      await this.store.putImmutable(key,bytes,a.mime,a.checksum);
      await db.query(`INSERT INTO assets(id,language_id,stable_code,kind,variety,purpose,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`,[a.asset_id,languageId,a.stable_code,a.kind,a.scope.variety,a.purpose,actorId]);
      const inserted=(await db.query(`INSERT INTO asset_versions(id,asset_id,language_id,version,version_code,object_key,checksum,byte_length,mime,metadata,job_id,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING asset_id,version AS asset_version,checksum,metadata_checksum`,[randomUUID(),a.asset_id,languageId,a.asset_version,a.version_code,key,a.checksum,a.byte_length,a.mime,a,jobId,actorId])).rows[0]!;
      await db.query("UPDATE media_jobs SET state='succeeded' WHERE id=$1",[jobId]);
      await db.query("INSERT INTO audit_events(actor_id,action,target_id) VALUES($1,'media.version_ingested',$2)",[actorId,a.asset_id]);
      return inserted as {asset_id:string;asset_version:number;checksum:string;metadata_checksum:string};
    });
  }
  async approve(actorId:string,assetId:string,version:number,checksum:string,metadataChecksum:string,gate:string,decision:'approved'|'rejected',notes:string):Promise<void> {
    await this.pool.query(`INSERT INTO asset_approvals(id,asset_id,asset_version,language_id,target_checksum,target_metadata_checksum,gate_type,reviewer_id,decision,notes)
      SELECT $1,a.id,$3,a.language_id,$4,$5,$6,$7,$8,$9 FROM assets a WHERE a.id=$2`,[randomUUID(),assetId,version,checksum,metadataChecksum,gate,actorId,decision,notes]);
  }
}

/** Referenced immutable bytes must exist and match; a provider URL or metadata header alone is insufficient. */
export async function preflightMedia(db:pg.PoolClient,store:AssetStore|undefined,languageId:string,refs:MediaReference[]):Promise<void> {
  for(const ref of refs){
    const row=(await db.query(`SELECT v.*,a.stable_code,p5_asset_approved(v.asset_id,v.version) AS approved
      FROM asset_versions v JOIN assets a ON a.id=v.asset_id WHERE v.asset_id=$1 AND v.version=$2 AND v.language_id=$3`,[ref.asset_id,ref.asset_version,languageId])).rows[0];
    if(!row||row.stable_code!==ref.asset_stable_code||!row.approved)throw new ContractError('INVALID_INPUT','Missing, cross-language or unapproved asset version');
    assetVersionSchema.parse(row.metadata);
    if(!store)throw new ContractError('SERVICE_UNAVAILABLE','Media storage preflight is not configured');
    const metadata=await store.inspect(row.object_key as string);
    if(!metadata||metadata.checksum!==row.checksum||metadata.bytes!==row.byte_length||metadata.mime!==row.mime)throw new ContractError('CONFLICT','Stored media metadata mismatch');
    await store.readVerified(row.object_key as string,row.checksum as string,row.byte_length as number);
  }
}
