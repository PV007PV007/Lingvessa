import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {mkdir,readFile,realpath,writeFile} from 'node:fs/promises';
import {isAbsolute,relative} from 'node:path';
import pg from 'pg';
import {localDatabaseUrl} from '../../infra/local/database-guard.js';
import {createFoundationPool} from '../../infra/persistence/database.js';
import {MediaRepository} from '../../infra/persistence/media.js';
import {ContentRepository} from '../../infra/persistence/content.js';
import {LessonRepository} from '../../infra/persistence/lessons.js';
import {loadExecutableLessonFixture} from '../../infra/persistence/p3-fixtures.js';
import {executableLessonFixtureSchema} from '../../packages/content-tools/src/p3-fixture.js';
import {mediaApprovalGates} from '../../packages/application/src/media.js';
import {seedBootstrap} from '../../prisma/seed.js';
import {p5MediaFixture,svgAsset} from '../../tests/support/p5-fixtures.js';
import {loadMediaLibrary,importMediaLibrary} from './media-library.js';
import type {LoadedMediaLibrary} from './media-library.js';
import type {ContentPayload} from '../../packages/activity-schemas/src/content.js';
import {assetObjectKey} from '../../packages/provider-adapters/storage/asset-integrity.js';
import {s3TestFixture,minioTestRevision} from './s3-test-fixture.js';

const mode=process.argv[2];
if(process.argv.length!==3||!['--synthetic','--real-m01'].includes(mode??''))throw new Error('Choose exactly --real-m01 or --synthetic; no automatic fallback');
const real=mode==='--real-m01',base=localDatabaseUrl(process.env);
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(process.env.GITHUB_HEAD_SHA)assert.equal(commit,process.env.GITHUB_HEAD_SHA);
let library:LoadedMediaLibrary;
if(real){
 const source=process.env.P5_M01_AUDIO_ROOT;
 if(!source||!isAbsolute(source))throw new Error('Explicit absolute external P5_M01_AUDIO_ROOT required');
 const rel=relative(await realpath(process.cwd()),await realpath(source));
 if(rel===''||(!rel.startsWith('../')&&!isAbsolute(rel)))throw new Error('Full M01 corpus must remain outside the Git checkout');
 library=await loadMediaLibrary(process.cwd(),{externalAudioRoot:source});
 assert.equal(library.entries.filter(e=>e.metadata.kind==='audio').length,420);
}else{
 // Explicit vectors test the same importer/PG/S3 path. They are never M01 byte evidence.
 const source=await loadMediaLibrary(process.cwd(),{metadataOnly:true}),id=randomUUID();
 const hash=createHash('sha256').update('SYNTHETIC_POSTGRESQL_S3_IMPORT').digest('hex');
 const batch={id,stable_code:'SYNTHETIC_S3_LIBRARY',version_code:'fixture-1',manifest_checksum:hash,authorization_checksum:hash,source_revision:commit,expected_assets:450,provenance:'450 original vector fixtures; no reference audio, no human or production approval'};
 library={audio_bytes_verified:true,registry:{...source.registry,approved_dataset_sha256:hash,voices:[],characters:[],batches:[{batch,authorization_path:'SYNTHETIC_FIXTURE_ONLY',records:[],approval_status:'PENDING_VISUAL_REVIEW'}]},
 entries:Array.from({length:450},(_,n)=>{const a=svgAsset(n%2?'cs':'en');a.metadata.stable_code='SYNTHETIC_S3_'+n;return {file:'SYNTHETIC/'+n+'.svg',metadata:a.metadata,bytes:a.bytes,batch_id:id};})};
}
assert.equal(library.entries.length,450);
const admin=new pg.Client({connectionString:base,connectionTimeoutMillis:3000}),name='lingvessa_p5_test_'+randomBytes(8).toString('hex'),url=new URL(base);url.pathname='/'+name;
const env={...process.env,LINGVESSA_ENV:'local',DATABASE_URL:url.toString()};
let pool:pg.Pool|undefined,created=false,storage:Awaited<ReturnType<typeof s3TestFixture>>|undefined;
try{
 await admin.connect();assert.equal((await admin.query('SHOW server_version_num')).rows[0].server_version_num,'180006');
 await admin.query('CREATE DATABASE "'+name+'" TEMPLATE template0 ENCODING \'UTF8\'');created=true;
 const migration=spawnSync('pnpm',['db:migrate'],{env,encoding:'utf8',timeout:120000});assert.equal(migration.status,0,'Isolated fixture migration failed');
 await seedBootstrap(env);storage=await s3TestFixture();pool=createFoundationPool(url.toString());
 const f=await p5MediaFixture(pool,storage.store()),before=async()=>({
  versions:(await pool!.query('SELECT count(*) FROM asset_versions')).rows[0].count,
  jobs:(await pool!.query('SELECT count(*) FROM media_jobs')).rows[0].count,
  audit:(await pool!.query("SELECT count(*) FROM audit_events WHERE action='media.version_ingested'")).rows[0].count,
 });
 const publicationCount=(await pool.query('SELECT count(*) FROM publications')).rows[0].count;
 const contentCount=(await pool.query('SELECT count(*) FROM content_versions')).rows[0].count;
 const outputs=await importMediaLibrary(f.media,f.author,library);
 assert.equal(outputs.length,450);const snapshot=await before();assert.deepEqual(snapshot,{versions:'450',jobs:'450',audit:'450'});
 assert.deepEqual(await importMediaLibrary(f.media,f.author,library),outputs);assert.deepEqual(await before(),snapshot);
 assert.equal((await pool.query('SELECT count(*) FROM media_library_batches')).rows[0].count,String(library.registry.batches.length));
 assert.equal((await pool.query("SELECT count(*) FROM media_jobs WHERE job_kind='library_import' AND state='succeeded' AND attempts=1")).rows[0].count,'450');
 assert.equal((await pool.query("SELECT count(*) FROM media_jobs WHERE job_kind='generation'")).rows[0].count,'0');
 assert.equal((await pool.query('SELECT count(*) FROM asset_approvals')).rows[0].count,'0');
 assert.equal((await pool.query('SELECT count(*) FROM publications')).rows[0].count,publicationCount);
 assert.equal((await pool.query('SELECT count(*) FROM content_versions')).rows[0].count,contentCount);
 const first=library.entries[0]!,a=first.metadata,key=assetObjectKey(a.asset_id,a.asset_version,a.checksum);
 const job=(await pool.query('SELECT job_id FROM asset_versions WHERE asset_id=$1 AND version=$2',[a.asset_id,a.asset_version])).rows[0].job_id as string;
 const changed=Buffer.from(first.bytes);changed[changed.length-1]=changed[changed.length-1]!^1;
 await assert.rejects(f.media.ingest(f.author,job,a,changed),{code:'INVALID_INPUT'});
 await assert.rejects(f.media.ingest(f.author,job,{...a,purpose:'Changed immutable purpose'},first.bytes),{code:'CONFLICT'});
 await assert.rejects(pool.query("UPDATE asset_versions SET metadata='{}' WHERE asset_id=$1",[a.asset_id]),{code:'23514'});
 await assert.rejects(pool.query('DELETE FROM asset_versions WHERE asset_id=$1',[a.asset_id]),{code:'23514'});
 assert.deepEqual(await before(),snapshot);
 const anonymous=await fetch(storage.config.endpoint+'/'+storage.config.bucket+'/'+key);await anonymous.body?.cancel();assert.equal(anonymous.status,403);
 const oldStore=storage.store();await pool.end();pool=undefined;await storage.stop();await assert.rejects(oldStore.inspect(key));await storage.start();
 pool=createFoundationPool(url.toString());const restarted=storage.store(),media=new MediaRepository(pool,restarted);
 for(const entry of library.entries){
  const m=entry.metadata,k=assetObjectKey(m.asset_id,m.asset_version,m.checksum);
  assert.deepEqual(Buffer.from(await restarted.readVerified(k,m.checksum,m.byte_length)),entry.bytes);
  const row: {checksum:string;byte_length:string;object_key:string;metadata:unknown}=(await pool.query('SELECT checksum,byte_length,object_key,metadata FROM asset_versions WHERE asset_id=$1 AND version=$2',[m.asset_id,m.asset_version])).rows[0];
  assert.equal(row.checksum,m.checksum);assert.equal(Number(row.byte_length),m.byte_length);assert.equal(row.object_key,k);assert.deepEqual(row.metadata,m);
 }
 assert.deepEqual(await importMediaLibrary(media,f.author,library),outputs);assert.deepEqual(await before(),snapshot);
 let testPublications=0,deliveredAssets=0,testFixtureApprovals=0;
 // Disposable test publications use fixture approvals, never new human/production approvals.
 // The importer above must still insert zero approvals/publications. Approved M01 bytes/metadata are unchanged.
 for(const language of ['en','cs'] as const){
  const source=f.sources[language],entries=real
   ?library.entries.filter(e=>e.metadata.kind==='audio'&&e.metadata.scope.language===language)
   :[library.entries.find(e=>e.metadata.scope.language===language)!];
  assert.equal(entries.length,real?210:1);
  const executable=executableLessonFixtureSchema.parse(JSON.parse(await readFile('content/fixtures/p3/'+language+'-lesson.json','utf8')));
  await loadExecutableLessonFixture(pool,f.author,executable);
  const payload=(await pool.query('SELECT payload FROM content_versions WHERE id=$1',[executable.content_version_id])).rows[0].payload as ContentPayload;
  const activity=payload.activities![0]!;
  for(const entry of entries){
   const ref={asset_id:entry.metadata.asset_id,asset_stable_code:entry.metadata.stable_code,asset_version:entry.metadata.asset_version,role:real?'test_imported_audio':'imported_vector'};
   activity.media_refs.push(ref);activity.contract!.presentation.media_refs.push(ref);
  }
  const revision=(await pool.query('SELECT revision FROM content_versions WHERE id=$1',[executable.content_version_id])).rows[0].revision as number;
  // The fixture's repositories used the closed pool; use the recovered pool explicitly.
  const content=new ContentRepository(pool,restarted);
  await content.saveDraft(f.author,source.language_id,payload,revision);
  await assert.rejects(content.validateVersion(executable.content_version_id),/unapproved/);
  const pins=entries.map(entry=>outputs.find(o=>o.asset_id===entry.metadata.asset_id)!);
  for(const out of pins)for(const gate of mediaApprovalGates){
   await media.approve(f.reviewer,out.asset_id,out.asset_version,out.checksum,out.metadata_checksum,gate,'approved','DISPOSABLE_TEST_FIXTURE_ONLY: exercise publication/delivery permission path; not a human review, production approval, or change to retained owner approval');
   testFixtureApprovals++;
  }
  const replacements=new Map([[executable.lesson_id,executable.content_version_id],...executable.ancestor_versions.map(a=>[a.entity_id,a.content_version_id] as const)]);
  const versionIds=source.entities.map(e=>replacements.get(e.id)??e.version_id);
  for(const id of versionIds){
   await content.validateVersion(id);const v=(await pool.query('SELECT checksum,revision FROM content_versions WHERE id=$1',[id])).rows[0];
   for(const gate of ['linguistic','pedagogical','technical','accessibility','media','originality'])await content.approve(f.reviewer,id,v.checksum,v.revision,gate,'approved','Synthetic test-only publication');
  }
  const publication=await content.publish({id:randomUUID(),actorId:f.reviewer,courseId:source.entities.find(e=>e.kind==='course')!.id,languageId:source.language_id,channel:'test',versionCode:'s3-import-'+language,versionIds});
  const storedPins:Array<{asset_id:string;asset_version:number;checksum:string;metadata_checksum:string}>=(await pool.query('SELECT asset_id,asset_version,checksum,metadata_checksum FROM publication_assets WHERE publication_id=$1 ORDER BY asset_id',[publication.id])).rows;
  assert.deepEqual(storedPins,pins.toSorted((a,b)=>a.asset_id.localeCompare(b.asset_id)));
  const profile=randomUUID();await pool.query('INSERT INTO language_profiles(id,user_id,language_id,variant_id) SELECT $1,$2,$3,id FROM variants WHERE language_id=$3 AND is_default',[profile,f.learner,source.language_id]);
  const run=await new LessonRepository(pool).start(f.learner,{language_profile_id:profile,publication_id:publication.id,lesson_id:executable.lesson_id});
  for(const entry of entries){
   const delivered=await media.bytesForRun(f.learner,run.id,activity.id,entry.metadata.asset_id,entry.metadata.asset_version);
   assert.deepEqual(Buffer.from(delivered.bytes),entry.bytes);assert.equal(delivered.metadata.checksum,entry.metadata.checksum);
   assert.equal(delivered.metadata.scope.language,language);deliveredAssets++;
  }
  const firstEntry=entries[0]!;
  await assert.rejects(media.bytesForRun(f.author,run.id,activity.id,firstEntry.metadata.asset_id,1),{code:'NOT_FOUND'});
  await assert.rejects(media.bytesForRun(f.learner,run.id,randomUUID(),firstEntry.metadata.asset_id,1),{code:'NOT_FOUND'});
  await assert.rejects(pool.query('UPDATE publication_assets SET checksum=$1 WHERE publication_id=$2',['0'.repeat(64),publication.id]),{code:'23514'});testPublications++;
 }
 assert.equal((await pool.query("SELECT count(*) FROM media_jobs WHERE job_kind='generation'")).rows[0].count,'0');
 assert.equal(testPublications,2);assert.equal(deliveredAssets,real?420:2);
 assert.equal(testFixtureApprovals,deliveredAssets*mediaApprovalGates.length);
 assert.equal(Number((await pool.query('SELECT count(*) FROM asset_approvals')).rows[0].count),testFixtureApprovals);
 const paths=['tools/p5/verify-m01-s3-import.ts','tools/p5/s3-test-fixture.ts','tools/p5/media-library.ts','infra/persistence/media.ts','infra/persistence/content.ts','packages/provider-adapters/storage/s3.ts'];
 const report={status:'PASS',scope:real?'REAL_M01_BYTES_POSTGRESQL_S3_IMPORT':'SYNTHETIC_POSTGRESQL_S3_IMPORT_NOT_M01',commit,source_sha:process.env.GITHUB_HEAD_SHA??null,database:'PostgreSQL 18.6',imported_versions:450,audio_assets:real?420:0,visual_drafts:real?30:0,synthetic_vectors:real?0:450,real_m01_audio_imported:real,exact_replay:true,immutable_update_and_delete_rejected:true,changed_bytes_rejected:true,database_pool_recreated:true,storage_adapter_restart_verified:true,storage_server_restart_verified:true,all_stored_bytes_verified:true,anonymous_access_denied:true,import_inserted_approvals:0,test_publications:testPublications,test_fixture_asset_approvals:testFixtureApprovals,test_approval_scope:'DISPOSABLE_TEST_FIXTURE_ONLY_NOT_OWNER_OR_PRODUCTION_APPROVAL',delivered_assets:deliveredAssets,delivered_real_m01_audio_assets:real?deliveredAssets:0,delivery_scope:'MEDIA_REPOSITORY_OWNER_SCOPED_TEST_LESSON_AFTER_S3_RESTART',foreign_user_and_activity_denied:true,production_publication_created:false,production_delivery_profile_approved:false,p6_authorized:false,test_server_source_revision:minioTestRevision,test_server_binary_sha256:storage.binary_sha256,code_bindings:Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])))};
 await mkdir('artifacts/p5',{recursive:true});await writeFile('artifacts/p5/'+(real?'m01-library-import-validation.json':'library-s3-validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{
 await pool?.end();try{if(created)await admin.query('DROP DATABASE "'+name+'" WITH (FORCE)');}finally{await admin.end();await storage?.close();}
}
