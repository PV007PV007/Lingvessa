import { createHash, randomUUID } from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {takeP5Quota} from './p5-quota.js';
import type pg from 'pg';
import { ContractError, assertUuid } from '../../packages/domain/src/identity.js';
import { assetVersionSchema, voiceSchema, characterSchema, mediaRequirementSchema,mediaLibraryBatchSchema } from '../../packages/activity-schemas/src/media.js';
import type { AssetStore, MediaReference } from '../../packages/application/src/media.js';
import { transaction } from './database.js';
import {deliveredMediaSchema} from '../../packages/activity-schemas/src/media-delivery.js';
import type {DeliveredMedia} from '../../packages/activity-schemas/src/media-delivery.js';
import type {LessonManifest} from '../../packages/activity-schemas/src/lesson.js';

/** P5 ingestion/preflight service. P8 owns Admin screens and generation-provider orchestration. */
export class MediaRepository {
  constructor(private readonly pool:pg.Pool,private readonly store:AssetStore) {}
  private async language(code:string):Promise<string> {
    const row=(await this.pool.query('SELECT id FROM languages WHERE stable_code=$1',[code])).rows[0];
    if(!row)throw new ContractError('INVALID_INPUT','Unknown media language');
    return row.id as string;
  }
  private async register(table:'voices'|'characters'|'media_library_batches',actor:string,input:{id:string;version_code:string},insert:(db:pg.PoolClient)=>Promise<void>){
    await transaction(this.pool,async db=>{
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`media-registry:${table}:${input.id}:${input.version_code}`]);
      const prior=(await db.query(`SELECT metadata,created_by FROM ${table} WHERE id=$1 AND version_code=$2`,[input.id,input.version_code])).rows[0];
      if(prior){if(prior.created_by!==actor||!isDeepStrictEqual(prior.metadata,input))throw new ContractError('CONFLICT','Media registry version is immutable');return;}await insert(db);
    });
  }
  async registerVoice(actor:string,input:unknown){
    assertUuid(actor);const v=voiceSchema.parse(input),lang=await this.language(v.scope.language);
    await this.register('voices',actor,v,async db=>{await db.query('INSERT INTO voices(id,version_code,language_id,stable_code,variety,metadata,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[v.id,v.version_code,lang,v.stable_code,v.scope.variety,v,actor]);});
  }
  async registerCharacter(actor:string,input:unknown){
    assertUuid(actor);const c=characterSchema.parse(input),lang=await this.language(c.scope.language);
    await this.register('characters',actor,c,async db=>{await db.query('INSERT INTO characters(id,version_code,language_id,stable_code,variety,voice_id,voice_version_code,metadata,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[c.id,c.version_code,lang,c.stable_code,c.scope.variety,c.voice_id,c.voice_version_code,c,actor]);});
  }
  async registerLibraryBatch(actor:string,input:unknown){
    assertUuid(actor);const v=mediaLibraryBatchSchema.parse(input);
    await this.register('media_library_batches',actor,v,async db=>{await db.query('INSERT INTO media_library_batches(id,stable_code,version_code,manifest_checksum,authorization_checksum,source_revision,expected_assets,metadata,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[v.id,v.stable_code,v.version_code,v.manifest_checksum,v.authorization_checksum,v.source_revision,v.expected_assets,v,actor]);});
  }
  async declareRequirement(actor:string,input:unknown){
    assertUuid(actor);const r=mediaRequirementSchema.parse(input),lang=await this.language(r.scope.language);
    await transaction(this.pool,async db=>{
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`media-requirement:${r.id}`]);
      const prior=(await db.query('SELECT * FROM media_requirements WHERE id=$1',[r.id])).rows[0];
      if(prior){
        const same=mediaRequirementSchema.parse({id:prior.id,...(prior.library_batch_id?{library_batch_id:prior.library_batch_id}:{target_content_version_id:prior.target_content_version_id,item_id:prior.item_id}),role:prior.role,required:prior.required,kind:prior.kind,scope:r.scope,specification_version:prior.specification_version,specification:prior.specification,accessibility_role:prior.accessibility_role});
        if(prior.created_by!==actor||prior.language_id!==lang||prior.variety!==r.scope.variety||!isDeepStrictEqual(same,r))throw new ContractError('CONFLICT','Media requirement is immutable');return;
      }
      await db.query('INSERT INTO media_requirements(id,target_content_version_id,item_id,library_batch_id,language_id,role,required,kind,variety,specification_version,specification,accessibility_role,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[r.id,r.target_content_version_id??null,r.item_id??null,r.library_batch_id??null,lang,r.role,r.required,r.kind,r.scope.variety,r.specification_version,r.specification,r.accessibility_role,actor]);
    });
  }
  async enqueue(actor:string,requirement:string,key:string,adapter:string,generator:string){return this.enqueueWork(actor,requirement,key,adapter,generator,'generation');}
  async enqueueLibraryImport(actor:string,requirement:string,key:string,generator:string){return this.enqueueWork(actor,requirement,key,'approved_media_import',generator,'library_import');}
  private async enqueueWork(actor:string,requirement:string,key:string,adapter:string,generator:string,kind:'generation'|'library_import'):Promise<string>{
    for(const id of [actor,requirement,key])assertUuid(id);
    if(!/^[A-Za-z0-9_-]{1,80}$/u.test(adapter)||!generator||generator.length>80)throw new ContractError('INVALID_INPUT','Versioned generation adapter required');
    return transaction(this.pool,async db=>{
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`media:${actor}:${key}`]);
      const hash=(await db.query('SELECT p2_json_checksum($1::jsonb) AS hash',[{requirementId:requirement,adapterCode:adapter,generatorVersion:generator,...(kind==='library_import'?{jobKind:kind}:{})}])).rows[0]?.hash;
      const prior=(await db.query('SELECT id,request_hash FROM media_jobs WHERE created_by=$1 AND idempotency_key=$2',[actor,key])).rows[0];
      if(prior){if(prior.request_hash!==hash)throw new ContractError('CONFLICT','Media idempotency key reused for another request');return prior.id as string;}
      const r=(await db.query('SELECT language_id,library_batch_id,created_by FROM media_requirements WHERE id=$1',[requirement])).rows[0];
      if(!r)throw new ContractError('NOT_FOUND','Media requirement not found');
      if((kind==='library_import')!==Boolean(r.library_batch_id)||(kind==='library_import'&&r.created_by!==actor))throw new ContractError('INVALID_INPUT','Media job kind or author differs from requirement');
      if(!await takeP5Quota(db,kind==='library_import'?'media_import':'media_generation',actor))throw new ContractError('RATE_LIMITED',kind==='library_import'?'Media import quota exhausted':'Media generation quota exhausted');
      const id=randomUUID();await db.query('INSERT INTO media_jobs(id,requirement_id,language_id,idempotency_key,request_hash,provider_adapter_code,generator_version,created_by,job_kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,requirement,r.language_id,key,hash,adapter,generator,actor,kind]);return id;
    });
  }
  async ingest(actorId:string,jobId:string,input:unknown,bytes:Uint8Array):Promise<{asset_id:string;asset_version:number;checksum:string;metadata_checksum:string}> {
    assertUuid(actorId);assertUuid(jobId);const a=assetVersionSchema.parse(input);
    if(bytes.byteLength!==a.byte_length)throw new ContractError('INVALID_INPUT','Asset byte length differs from manifest');
    if(createHash('sha256').update(bytes).digest('hex')!==a.checksum)throw new ContractError('INVALID_INPUT','Asset checksum differs from manifest');
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
    assertUuid(actorId);assertUuid(assetId);
    const result=await this.pool.query(`INSERT INTO asset_approvals(id,asset_id,asset_version,language_id,target_checksum,target_metadata_checksum,gate_type,reviewer_id,decision,notes)
      SELECT $1::uuid,a.id,$3::integer,a.language_id,$4::text,$5::text,$6::text,$7::uuid,$8::text,$9::text FROM assets a WHERE a.id=$2::uuid`,[randomUUID(),assetId,version,checksum,metadataChecksum,gate,actorId,decision,notes]);
    if(result.rowCount!==1)throw new ContractError('NOT_FOUND','Asset not found');
  }
  async forRun(userId:string,runId:string,itemId:string):Promise<DeliveredMedia[]> {
    for(const id of [userId,runId,itemId])assertUuid(id);
    const run=(await this.pool.query('SELECT manifest,publication_id,language_id FROM lesson_runs WHERE id=$1 AND user_id=$2',[runId,userId])).rows[0];
    if(!run)throw new ContractError('NOT_FOUND','Lesson run not found');
    const manifest=run.manifest as LessonManifest,activity=manifest.activities.find(a=>a.id===itemId);
    if(!activity)throw new ContractError('NOT_FOUND','Activity not in this pinned run');
    const media:DeliveredMedia[]=[];
    for(const ref of activity.presentation.media_refs){
      const row=(await this.pool.query(`SELECT v.metadata,v.checksum,v.metadata_checksum,p.checksum AS pinned_checksum,p.metadata_checksum AS pinned_metadata_checksum
        FROM publication_assets p JOIN asset_versions v ON v.asset_id=p.asset_id AND v.version=p.asset_version AND v.language_id=p.language_id
        WHERE p.publication_id=$1 AND p.asset_id=$2 AND p.asset_version=$3 AND p.language_id=$4`,[run.publication_id,ref.asset_id,ref.asset_version,run.language_id])).rows[0];
      if(!row||row.checksum!==row.pinned_checksum||row.metadata_checksum!==row.pinned_metadata_checksum)throw new ContractError('CONFLICT','Media pin failed integrity');
      const a=assetVersionSchema.parse(row.metadata);
      if(a.stable_code!==ref.asset_stable_code)throw new ContractError('CONFLICT','Asset semantic identity differs from pin');
      // Audio remains labelled with its real variety; the client never relabels a different voice.
      media.push(deliveredMediaSchema.parse({asset_id:a.asset_id,asset_version:a.asset_version,role:ref.role,kind:a.kind,scope:a.scope,mime:a.mime,checksum:a.checksum,byte_length:a.byte_length,
        alt_text:a.alt_text,decorative:a.decorative,...(a.duration_ms?{duration_ms:a.duration_ms}:{}),...(a.transcript?{transcript:a.transcript}:{}),...(a.speed?{speed:a.speed}:{}),
        ...(a.character_id?{character_id:a.character_id,character_version_code:a.character_version_code}:{}),
        ...(a.voice_id?{voice_id:a.voice_id,voice_version_code:a.voice_version_code}:{}),...(a.turns?{turns:a.turns}:{}),...(a.normal_asset_id?{normal_asset_id:a.normal_asset_id,normal_asset_version:a.normal_asset_version}:{})}));
    }
    return media;
  }
  async bytesForRun(userId:string,runId:string,itemId:string,assetId:string,version:number):Promise<{metadata:DeliveredMedia;bytes:Uint8Array}> {
    const metadata=(await this.forRun(userId,runId,itemId)).find(a=>a.asset_id===assetId&&a.asset_version===version);
    if(!metadata)throw new ContractError('NOT_FOUND','Asset not in this run/activity');
    return {metadata,bytes:await this.store.readVerified(`assets/${assetId}/${version}/${metadata.checksum}`,metadata.checksum,metadata.byte_length)};
  }
  async recordTranscriptSupport(userId:string,runId:string,itemId:string):Promise<void> {
    const media=await this.forRun(userId,runId,itemId);
    if(!media.some(a=>a.kind==='audio'&&a.transcript))throw new ContractError('NOT_FOUND','No audio transcript for this activity');
    await transaction(this.pool,async db=>{
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`transcript:${userId}:${runId}:${itemId}`]);
      await db.query(`INSERT INTO audit_events(actor_id,action,target_id,payload)
        SELECT $1::uuid,'media.transcript_opened',$2::uuid,jsonb_build_object('item_id',$3::uuid)
        WHERE NOT EXISTS(SELECT 1 FROM audit_events WHERE actor_id=$1 AND action='media.transcript_opened' AND target_id=$2 AND payload->>'item_id'=$3::text)`,[userId,runId,itemId]);
    });
    // This records use only. The accepted conservative transcript weighting remains server-authoritative.
  }
}

/** Check declared roles against this content version, including optional roles when present. */
export async function preflightMediaRequirements(db:pg.PoolClient,versionId:string):Promise<void> {
  const result=await db.query('SELECT p5_media_requirements_fulfilled($1::uuid) AS fulfilled',[versionId]);
  if(result.rows[0]?.fulfilled!==true)throw new ContractError('INVALID_INPUT','required media declaration is not fulfilled or accessibility role differs');
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

