import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import {localDatabaseUrl} from '../../infra/local/database-guard.js';
import {createFoundationPool} from '../../infra/persistence/database.js';
import {seedBootstrap} from '../../prisma/seed.js';
import {LocalAssetStore} from '../../packages/provider-adapters/storage/local.js';
import {p5MediaFixture,svgAsset} from '../support/p5-fixtures.js';
import {takeP5Quota,P5_QUOTAS,p5QuotaKey} from '../../infra/persistence/p5-quota.js';

test('P5 library contract: 450 synthetic imports, immutable replay, ownership and policy gates',{timeout:300000},async()=>{
 const base=localDatabaseUrl(process.env),admin=new pg.Client({connectionString:base}),name='lingvessa_p5_test_'+randomBytes(8).toString('hex'),url=new URL(base);url.pathname='/'+name;
 const env={...process.env,LINGVESSA_ENV:'local',DATABASE_URL:url.toString()},root=await mkdtemp(join(tmpdir(),'p5-library-contract-'));let pool:pg.Pool|undefined,created=false;
 try{
  await admin.connect();assert.equal((await admin.query('SHOW server_version_num')).rows[0].server_version_num,'180006');await admin.query('CREATE DATABASE "'+name+'" TEMPLATE template0 ENCODING \'UTF8\'');created=true;
  const migration=spawnSync('pnpm',['db:migrate'],{env,encoding:'utf8',timeout:60000});assert.equal(migration.status,0,migration.stdout.slice(-1500)+migration.stderr.slice(-1000));await seedBootstrap(env);
  pool=createFoundationPool(url.toString());const db=pool,f=await p5MediaFixture(db,new LocalAssetStore(root)),hash=createHash('sha256').update('Synthetic P5 library contract only').digest('hex');
  const batch={id:randomUUID(),stable_code:'SYNTHETIC_LIBRARY_CONTRACT',version_code:'fixture-1',manifest_checksum:hash,authorization_checksum:hash,source_revision:'0'.repeat(40),expected_assets:450,provenance:'Original programmatic test vectors; not M01 audio, no production media approval'};
  await f.media.registerLibraryBatch(f.author,batch);await f.media.registerLibraryBatch(f.author,batch);
  await assert.rejects(f.media.registerLibraryBatch(f.author,{...batch,provenance:'Changed'}),/immutable/);
  await assert.rejects(f.media.registerLibraryBatch(f.learner,{...batch,id:randomUUID(),stable_code:'UNAUTHORIZED'}),{code:'42501'});
  for(let n=0;n<P5_QUOTAS.media_generation;n++)assert(await takeP5Quota(db,'media_generation',f.author));
  const contentBefore=(await db.query('SELECT count(*) FROM content_versions')).rows[0].count,records=[];
  for(let n=0;n<450;n++){
   const asset=svgAsset('en');asset.metadata.stable_code='SYNTHETIC_LIBRARY_'+n;const id=randomUUID(),key=randomUUID();
   const requirement={id,library_batch_id:batch.id,role:'vector_'+n,required:true,kind:'vector',scope:asset.metadata.scope,specification_version:'fixture-1',specification:'Original synthetic vector contract only',accessibility_role:'semantic'};
   await f.media.declareRequirement(f.author,requirement);const job=await f.media.enqueueLibraryImport(f.author,id,key,'p5-fixture-1'),output=await f.media.ingest(f.author,job,asset.metadata,asset.bytes);records.push({asset,requirement,key,job,output});
  }
  assert.equal((await db.query('SELECT count(*) FROM asset_versions')).rows[0].count,'450');assert.equal((await db.query("SELECT count(*) FROM media_jobs WHERE job_kind='generation'")).rows[0].count,'0');
  assert.equal((await db.query('SELECT count(*) FROM asset_approvals')).rows[0].count,'0');assert.equal((await db.query('SELECT count(*) FROM content_versions')).rows[0].count,contentBefore);
  for(const r of records){await f.media.declareRequirement(f.author,r.requirement);assert.equal(await f.media.enqueueLibraryImport(f.author,r.requirement.id,r.key,'p5-fixture-1'),r.job);assert.deepEqual(await f.media.ingest(f.author,r.job,r.asset.metadata,r.asset.bytes),r.output);}
  assert.equal((await db.query('SELECT attempts FROM auth_rate_windows WHERE key_hash=$1',[p5QuotaKey('media_import',f.author)])).rows[0].attempts,450);
  assert.equal((await db.query("SELECT count(*) FROM media_jobs WHERE attempts=1 AND state='succeeded'")).rows[0].count,'450');
  const first=records[0]!;await assert.rejects(f.media.enqueue(f.author,first.requirement.id,randomUUID(),'programmatic_fixture','p5-fixture-1'),/job kind/);
  await assert.rejects(db.query('UPDATE media_library_batches SET expected_assets=451 WHERE id=$1',[batch.id]),{code:'23514'});
  await assert.rejects(db.query("UPDATE media_jobs SET job_kind='generation' WHERE id=$1",[first.job]),{code:'23514'});
  await assert.rejects(f.media.declareRequirement(f.author,{...first.requirement,id:randomUUID(),role:'overflow'}),{code:'23514'});
  await assert.rejects(db.query(`INSERT INTO speech_policies(id,stable_code,version_code,language_id,variety,target_feature,provider_code,model_version,confidence_threshold,test_only,calibration_reference,approved_by)
   VALUES($1,'FORGED_CANDIDATE','1',$2,'en-GB','en_th_unvoiced','local_acoustic_ipa','xlsr53-espeak-2c733782da56-1',0.9,false,'Invalid promotion of candidate pilot',$3)`,[randomUUID(),f.sources.en.language_id,f.reviewer]),{code:'23514'});
  mkdirSync('artifacts/p5',{recursive:true});writeFileSync('artifacts/p5/media-library-validation.json',JSON.stringify({status:'PASS',scope:'SYNTHETIC_LIBRARY_CONTRACT_NOT_M01_AUDIO_QA',database:'PostgreSQL 18.6',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source_sha:process.env.GITHUB_HEAD_SHA??null,synthetic_imports:450,generation_jobs:0,approval_rows:0,production_publication_created:false,real_m01_audio_imported:false,gates:['separate_import_quota','450_immutable_imports','full_replay','ownership','batch_cap','candidate_production_policy_rejected']},null,2)+'\n');
 }finally{await pool?.end();if(created)await admin.query('DROP DATABASE "'+name+'" WITH (FORCE)');await admin.end();await rm(root,{recursive:true,force:true});}
});
