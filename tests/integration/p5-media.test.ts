import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import {localDatabaseUrl} from '../../infra/local/database-guard.js';
import {createFoundationPool} from '../../infra/persistence/database.js';
import {seedBootstrap} from '../../prisma/seed.js';
import {LocalAssetStore} from '../../packages/provider-adapters/storage/local.js';
import {assetObjectKey} from '../../packages/provider-adapters/storage/asset-integrity.js';
import {p5MediaFixture} from '../support/p5-fixtures.js';
import {takeP5Quota,P5_QUOTAS} from '../../infra/persistence/p5-quota.js';

test('P5 real PostgreSQL: media ownership, immutable versions, bytes preflight and publication pins',{timeout:240000},async()=>{
 const base=localDatabaseUrl(process.env),admin=new pg.Client({connectionString:base,connectionTimeoutMillis:2000}),name=`lingvessa_p5_test_${randomBytes(8).toString('hex')}`,url=new URL(base);url.pathname=`/${name}`;
 const env={...process.env,LINGVESSA_ENV:'local',DATABASE_URL:url.toString()},root=await mkdtemp(join(tmpdir(),'p5-assets-'));let created=false,pool:pg.Pool|undefined;
 const gates:Array<{gate:string;status:'PASS'}>=[],gate=async(name:string,f:()=>Promise<void>)=>{await f();gates.push({gate:name,status:'PASS'});console.log(`P5_GATE PASS ${name}`);};
 const migrate=()=>{const r=spawnSync('pnpm',['db:migrate'],{env,encoding:'utf8',timeout:60000});assert.equal(r.status,0,`${r.stdout.slice(-2500)} ${r.stderr.slice(-1200)}`);};
 try{
  await admin.connect();assert.equal((await admin.query('SHOW server_version_num')).rows[0].server_version_num,'180006');
  await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0 ENCODING 'UTF8'`);created=true;migrate();await seedBootstrap(env);pool=createFoundationPool(url.toString());const db=pool,store=new LocalAssetStore(root);
  const reject=async(sql:string,args:unknown[],codes=['23503','23514','42501'])=>assert.rejects(db.query(sql,args),(e:unknown)=>Boolean(e&&typeof e==='object'&&'code'in e&&codes.includes(String(e.code))));
  await gate('P5-MEDIA-DB-001 clean migration/replay and phase boundary',async()=>{
   migrate();await seedBootstrap(env);assert.equal((await db.query('SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL')).rows[0].count,'6');
   for(const table of ['voices','characters','media_requirements','media_jobs','assets','asset_versions','asset_approvals','content_media_bindings','publication_assets'])assert((await db.query('SELECT to_regclass($1) AS name',[table])).rows[0].name);
   assert.equal((await db.query("SELECT to_regclass('ai_runs') AS name")).rows[0].name,null);
  });
  const f=await p5MediaFixture(db,store),en=await f.load('en'),cs=await f.load('cs');
  await gate('P5-MEDIA-JOB-001 idempotency and exact immutable ingestion replay',async()=>{
   assert.equal(await f.media.enqueue(f.author,en.requirement,en.key,'programmatic_fixture','p5-fixture-1'),en.job);
   await assert.rejects(f.media.enqueue(f.author,cs.requirement,en.key,'programmatic_fixture','p5-fixture-1'),/reused/);
   assert.deepEqual(await f.media.ingest(f.author,en.job,en.asset.metadata,en.asset.bytes),en.ingested);
   const snapshot=async()=>({
    job:(await db.query('SELECT * FROM media_jobs WHERE id=$1',[en.job])).rows,
    versions:(await db.query('SELECT * FROM asset_versions WHERE job_id=$1',[en.job])).rows,
    audit:(await db.query("SELECT * FROM audit_events WHERE target_id=$1 AND action='media.version_ingested'",[en.ingested.asset_id])).rows,
   });
   const before=await snapshot(),a=en.asset.metadata,key=assetObjectKey(a.asset_id,a.asset_version,a.checksum);
   assert.equal(before.job[0]?.state,'succeeded');assert.equal(before.job[0]?.attempts,1);
   assert.equal(before.versions.length,1);assert.equal(before.audit.length,1);
   const changed=Buffer.from(en.asset.bytes.toString('utf8').replace('fill="#345"','fill="#346"'));
   assert.equal(changed.byteLength,a.byte_length);
   assert.notEqual(createHash('sha256').update(changed).digest('hex'),a.checksum);
   await assert.rejects(f.media.ingest(f.author,en.job,a,changed),{code:'INVALID_INPUT',message:'Asset checksum differs from manifest'});
   assert.deepEqual(await snapshot(),before,'A rejected replay must preserve job, immutable version and audit rows');
   assert.deepEqual(await store.readVerified(key,a.checksum,a.byte_length),en.asset.bytes,'A rejected replay must preserve original bytes');
   assert.deepEqual(await f.media.ingest(f.author,en.job,a,en.asset.bytes),en.ingested,'Valid replay remains idempotent after rejection');
   assert.deepEqual(await snapshot(),before,'Valid replay must not add attempts, versions or audit events');
   await assert.rejects(f.media.ingest(f.author,en.job,{...en.asset.metadata,alt_text:'Changed'},en.asset.bytes),/immutable/);
   await reject("UPDATE media_jobs SET state='queued' WHERE id=$1",[en.job]);
   await reject('UPDATE asset_versions SET metadata=$1 WHERE asset_id=$2',[{changed:true},en.ingested.asset_id]);
  });
  await gate('P5-MEDIA-QA-001 human approvals and missing/unapproved/required asset rejection',async()=>{
   await assert.rejects(f.publish('en','missing'),/required media declaration/);
   await f.bind(en);await assert.rejects(f.content.validateVersion(en.lesson.version_id),/unapproved/);
   await assert.rejects(f.media.approve(f.learner,en.ingested.asset_id,1,en.ingested.checksum,en.ingested.metadata_checksum,'technical','approved','Unprivileged'),{code:'42501'});
   await assert.rejects(f.media.approve(f.reviewer,en.ingested.asset_id,1,'0'.repeat(64),en.ingested.metadata_checksum,'technical','approved','Stale checksum'),{code:'23514'});
   await f.approve(en.ingested);await f.approve(cs.ingested);await f.bind(cs);await f.content.validateVersion(en.lesson.version_id);
  });
  await gate('P5-MEDIA-ISO-001 direct DB cross-language references and author mismatch rejected',async()=>{
   await reject('INSERT INTO content_media_bindings VALUES($1,$2,$3,$4,1,$5)',[en.lesson.version_id,en.activity.id,en.source.language_id,cs.ingested.asset_id,'cross_language']);
   await reject('INSERT INTO content_media_bindings VALUES($1,$2,$3,$4,1,$5)',[en.lesson.version_id,cs.activity.id,en.source.language_id,en.ingested.asset_id,'cross_item']);
   await assert.rejects(f.media.ingest(f.learner,en.job,en.asset.metadata,en.asset.bytes),/not owned/);
   const forged=structuredClone(en.payload);forged.activities![0]!.media_refs[0]!.asset_stable_code='UNKNOWN';
   const rev=(await db.query('SELECT revision FROM content_versions WHERE id=$1',[en.lesson.version_id])).rows[0].revision;
   await assert.rejects(f.content.saveDraft(f.author,en.source.language_id,forged,rev),/mismatch/);
  });
  await gate('P5-MEDIA-VERSION-001 new version, immutable publication, rollback pointer',async()=>{
   const en2=await f.load('en',2);await f.approve(en2.ingested);await f.bind(en2);
   const published=await f.publish('en','media-1'),again=await f.publish('en','media-2');
   const manifest=published.manifest as {assets:unknown[]};assert.equal(manifest.assets.length,2);
   assert.equal((await db.query('SELECT count(*) FROM publication_assets WHERE publication_id=$1',[published.id])).rows[0].count,'2');
   await reject('UPDATE publication_assets SET checksum=$1 WHERE publication_id=$2',['0'.repeat(64),published.id]);
   await reject('DELETE FROM content_media_bindings WHERE content_version_id=$1',[en.lesson.version_id]);
   await reject('DELETE FROM asset_versions WHERE asset_id=$1',[en.ingested.asset_id]);
   await f.content.activate(f.reviewer,published.id,null);await f.content.activate(f.reviewer,again.id,1);await f.content.activate(f.reviewer,published.id,2);
   assert.deepEqual((await db.query('SELECT manifest FROM publications WHERE id=$1',[published.id])).rows[0].manifest,manifest);
   await reject('INSERT INTO publication_assets VALUES($1,$2,1,$3,$4,$5)',[published.id,cs.ingested.asset_id,en.source.language_id,cs.ingested.checksum,cs.ingested.metadata_checksum]);
  });
  await gate('P5-MEDIA-BYTES-001 missing and tampered objects fail preflight; generation not in lesson path',async()=>{
   const a=cs.asset.metadata,key=assetObjectKey(a.asset_id,1,a.checksum),path=join(root,key.replaceAll('/','_'));
   await writeFile(path,Buffer.from(JSON.stringify({key,checksum:a.checksum,bytes:a.byte_length,mime:a.mime})+'\ncorrupt'));
   await assert.rejects(f.content.validateVersion(cs.lesson.version_id),/integrity/);
   await rm(path);await assert.rejects(f.content.validateVersion(cs.lesson.version_id),/metadata mismatch/);
   await store.putImmutable(key,cs.asset.bytes,a.mime,a.checksum);await f.publish('cs','media-cs-1');
   assert.equal((await db.query('SELECT count(*) FROM media_jobs')).rows[0].count,'3','Publishing never starts generation');
  });
  await gate('P5-MEDIA-QUOTA-001 generation quota separates work cost; replay and learning do not consume it',async()=>{
   for(let n=0;n<P5_QUOTAS.media_generation;n++)await takeP5Quota(db,'media_generation',f.author);
   assert.equal(await f.media.enqueue(f.author,en.requirement,en.key,'programmatic_fixture','p5-fixture-1'),en.job);
   await assert.rejects(f.media.enqueue(f.author,en.requirement,randomUUID(),'programmatic_fixture','p5-fixture-1'),/quota exhausted/);
   assert.equal((await db.query('SELECT count(*) FROM media_jobs')).rows[0].count,'3');
   assert.equal(await f.identity.allowLearningAction(f.author),true);assert.equal(await f.identity.allowSpeechTransport(f.author),true);
  });
  await gate('P5-MEDIA-DB-002 clean recreation and migration/seed recovery',async()=>{
   await db.end();pool=undefined;await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);created=false;
   await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0 ENCODING 'UTF8'`);created=true;migrate();await seedBootstrap(env);await seedBootstrap(env);
  });
  mkdirSync('artifacts/p5',{recursive:true});writeFileSync('artifacts/p5/media-database-validation.json',JSON.stringify({phase:'P5',scope:'IMP-P5-001 media foundation only',status:'PASS',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source_sha:process.env.GITHUB_HEAD_SHA??null,database:'PostgreSQL 18.6',gates},null,2)+'\n');
 }finally{await pool?.end();if(created)await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end();await rm(root,{recursive:true,force:true});}
});
