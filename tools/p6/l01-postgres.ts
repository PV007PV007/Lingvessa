import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {localDatabaseUrl} from '../../infra/local/database-guard.js';
import {createFoundationPool} from '../../infra/persistence/database.js';
import {importAuthoredUnit} from '../../infra/persistence/authored-unit.js';
import {IdentityRepository} from '../../infra/persistence/identity.js';
import {ContentRepository} from '../../infra/persistence/content.js';
import {MediaRepository} from '../../infra/persistence/media.js';
import {LessonRepository} from '../../infra/persistence/lessons.js';
import {SpeechRepository} from '../../infra/persistence/speech.js';
import {seedBootstrap} from '../../prisma/seed.js';
import {mediaApprovalGates} from '../../packages/application/src/media.js';
import {assetObjectKey} from '../../packages/provider-adapters/storage/asset-integrity.js';
import {s3TestFixture,minioTestRevision} from '../p5/s3-test-fixture.js';
import {loadL01} from './l01-input.js';
import {command} from '../../tests/support/p4-fixtures.js';
import {l01BrowserGate} from './l01-browser-gate.js';

const mode=process.argv[2];
if(process.argv.length!==3||(mode!=='--real-l01'&&mode!=='--svg-text-slice'))throw new Error('Select --real-l01 or --svg-text-slice explicitly; no fallback');
const {unit,lesson,library,entries}=await loadL01(mode),base=localDatabaseUrl(process.env);
const source_sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();if(process.env.GITHUB_HEAD_SHA)assert.equal(source_sha,process.env.GITHUB_HEAD_SHA);
const admin=new pg.Client({connectionString:base,connectionTimeoutMillis:3000}),name='lingvessa_p6_test_'+randomBytes(8).toString('hex'),url=new URL(base);url.pathname='/'+name;
let pool:pg.Pool|undefined,storage:Awaited<ReturnType<typeof s3TestFixture>>|undefined,created=false;
const gates:Array<{gate:string;status:'PASS'}>=[];
const gate=async(name:string,work:()=>Promise<void>)=>{await work();gates.push({gate:name,status:'PASS'});console.log('P6_L01_GATE PASS '+name);};
try{
  await admin.connect();assert.equal((await admin.query('SHOW server_version_num')).rows[0].server_version_num,'180006');
  await admin.query('CREATE DATABASE "'+name+'" TEMPLATE template0 ENCODING \'UTF8\'');created=true;
  const env={...process.env,LINGVESSA_ENV:'local',DATABASE_URL:url.toString()};
  const migration=spawnSync('pnpm',['db:migrate'],{env,encoding:'utf8',timeout:120000});assert.equal(migration.status,0,'P6 isolated database migration failed');
  await seedBootstrap(env);storage=await s3TestFixture();pool=createFoundationPool(url.toString());
  let identity=new IdentityRepository(pool),media=new MediaRepository(pool,storage.store());
  const password=randomBytes(32).toString('base64url'),suffix=randomUUID();
  const author=await identity.provision('author-'+suffix+'@example.invalid',password),reviewer=await identity.provision('reviewer-'+suffix+'@example.invalid',password);
  const learner=await identity.provision('learner-'+suffix+'@example.invalid',password);
  await pool.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE stable_code='content_editor'",[author]);
  await pool.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE stable_code IN ('linguistic_reviewer','pedagogical_reviewer','administrator')",[reviewer]);
  const count=async(table:string)=>Number((await pool!.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
  await gate('authority and missing-byte closure reject without partial content',async()=>{
    await assert.rejects(importAuthoredUnit(pool!,learner,unit),{code:'FORBIDDEN'});
    await assert.rejects(importAuthoredUnit(pool!,author,unit),{code:'INVALID_INPUT'});assert.equal(await count('content_versions'),0);
  });
  for(const v of library.registry.voices)await media.registerVoice(author,v);
  for(const c of library.registry.characters)await media.registerCharacter(author,c);
  for(const b of library.registry.batches)await media.registerLibraryBatch(author,b.batch);
  const jobs=new Map<string,string>(),outputs:Array<{asset_id:string;asset_version:number;checksum:string;metadata_checksum:string}>=[];
  await gate('real approved media bytes import and replay; no generation',async()=>{
    for(const e of entries){const m=e.metadata,id=randomUUID();
      await media.declareRequirement(author,{id,library_batch_id:e.batch_id,role:m.stable_code,required:true,kind:m.kind,scope:m.scope,specification_version:m.version_code,specification:'Immutable approved source '+e.file+'; sha256 '+m.checksum,accessibility_role:m.decorative?'decorative':'semantic'});
      const job=await media.enqueueLibraryImport(author,id,randomUUID(),m.rights.generator_version);jobs.set(m.asset_id,job);
      const out=await media.ingest(author,job,m,e.bytes);outputs.push(out);assert.deepEqual(await media.ingest(author,job,m,e.bytes),out);
    }
    assert.equal(await count('asset_versions'),entries.length);
    assert.equal((await pool!.query("SELECT count(*) FROM media_jobs WHERE job_kind='generation'")).rows[0].count,'0');
    const first=entries[0]!,job=jobs.get(first.metadata.asset_id)!;const altered=Buffer.from(first.bytes);altered[altered.length-1]=altered[altered.length-1]!^1;
    await assert.rejects(media.ingest(author,job,first.metadata,altered),{code:'INVALID_INPUT'});
    await assert.rejects(media.ingest(author,job,{...first.metadata,purpose:'Changed immutable purpose'},first.bytes),{code:'CONFLICT'});
    await assert.rejects(pool!.query("UPDATE asset_versions SET metadata='{}' WHERE asset_id=$1",[first.metadata.asset_id]),{code:'23514'});
  });
  let imported:Awaited<ReturnType<typeof importAuthoredUnit>>;
  await gate('authored import/replay rejects changed versions and inserts no approval/publication',async()=>{
    imported=await importAuthoredUnit(pool!,author,unit);assert.equal(imported.status,'loaded');
    assert.equal((await importAuthoredUnit(pool!,author,unit)).status,'unchanged');
    assert.equal(await count('content_versions'),unit.entities.length);
    const changed=structuredClone(unit);changed.activities[0]!.presentation.prompt+=' Changed.';
    await assert.rejects(importAuthoredUnit(pool!,author,changed),{code:'CONFLICT'});
    await assert.rejects(importAuthoredUnit(pool!,learner,unit),{code:'FORBIDDEN'});
    assert.equal((await pool!.query("SELECT count(*) FROM audit_events WHERE action='content.authored_unit_imported'")).rows[0].count,'1');
    for(const table of ['approvals','asset_approvals','publications'])assert.equal(await count(table),0);
  });
  await gate('adapter restart, new PostgreSQL pool, immutable readback and replay',async()=>{
    const old=storage!.store(),m=entries[0]!.metadata,key=assetObjectKey(m.asset_id,m.asset_version,m.checksum);
    await pool!.end();pool=undefined;await storage!.stop();await assert.rejects(old.inspect(key));await storage!.start();pool=createFoundationPool(url.toString());
    media=new MediaRepository(pool,storage!.store());identity=new IdentityRepository(pool);
    assert.equal((await importAuthoredUnit(pool,author,unit)).status,'unchanged');
    for(const e of entries){const a=e.metadata;assert.deepEqual(Buffer.from(await storage!.store().readVerified(assetObjectKey(a.asset_id,a.asset_version,a.checksum),a.checksum,a.byte_length)),e.bytes);
      assert.deepEqual(await media.ingest(author,jobs.get(a.asset_id)!,a,e.bytes),outputs.find(o=>o.asset_id===a.asset_id));}
  });
  const content=new ContentRepository(pool!,storage.store());
  const publicationId=randomUUID();
  await gate('disposable test publication validates exact version and media pins',async()=>{
    await assert.rejects(content.validateVersion(lesson.version_id),/unapproved/);
    for(const out of outputs)for(const gate of mediaApprovalGates)await media.approve(reviewer,out.asset_id,out.asset_version,out.checksum,out.metadata_checksum,gate,'approved','DISPOSABLE_TEST_PERMISSION_ONLY; not owner content acceptance or production approval.');
    for(const id of imported!.version_ids){await content.validateVersion(id);const v=(await pool!.query('SELECT checksum,revision FROM content_versions WHERE id=$1',[id])).rows[0];
      for(const gate of ['linguistic','pedagogical','technical','accessibility','media','originality'])await content.approve(reviewer,id,v.checksum,v.revision,gate,'approved','DISPOSABLE_TEST_PERMISSION_ONLY; exercise authored publication path, not human review.');}
    await content.publish({id:publicationId,actorId:reviewer,courseId:unit.entities.find(e=>e.kind==='course')!.id,languageId:unit.language_id,channel:'test',versionCode:lesson.version_code,versionIds:imported!.version_ids});
    await content.activate(reviewer,publicationId,null);
    assert.deepEqual((await pool!.query('SELECT asset_id,asset_version,checksum,metadata_checksum FROM publication_assets WHERE publication_id=$1 ORDER BY asset_id',[publicationId])).rows,outputs.toSorted((a,b)=>a.asset_id.localeCompare(b.asset_id)));
    assert.equal((await importAuthoredUnit(pool!,author,unit)).status,'unchanged');
    await assert.rejects(pool!.query("UPDATE content_versions SET payload=payload||'{\"title\":\"changed\"}'::jsonb WHERE id=$1",[lesson.version_id]),{code:'23514'});
  });
  const lessons=new LessonRepository(pool!);
  const profile=async(user:string)=>{const id=randomUUID();await pool!.query('INSERT INTO language_profiles(id,user_id,language_id,variant_id) SELECT $1,$2,$3,id FROM variants WHERE language_id=$3 AND is_default',[id,user,unit.language_id]);return id;};
  const profileId=await profile(learner),start={language_profile_id:profileId,publication_id:publicationId,lesson_id:unit.lesson_id};let run=await lessons.start(learner,start),delivered=0,neutral=0;
  await gate('authored lesson journey, wrong/reveal, reload, replay, remediation and Review seed',async()=>{
    // No scoring policy or provider is installed. This explicitly tests the neutral unavailable route only.
    const speech=new SpeechRepository(pool!,{put:async()=>{throw new Error('No speech bytes expected');},read:async()=>{throw new Error('No speech bytes expected');},delete:async()=>undefined,prune:async()=>0},
      {code:'p6_unavailable',modelVersion:'none-1',available:false,evaluate:async()=>{throw new Error('No provider invocation permitted');}},randomBytes(32));
    let wrong=false,turns=0;
    while(run.state!=='completed'){
      assert(turns++<45);const a=unit.activities.find(a=>a.id===run.current_activity_id)!;
      const resume=await lessons.start(learner,start);assert.equal(resume.id,run.id);assert.equal(resume.position,run.position);
      assert.equal((await lessons.get(learner,run.id)).position,run.position);
      if(run.state==='active')for(const r of a.presentation.media_refs){const e=entries.find(e=>e.metadata.asset_id===r.asset_id)!;const result=await media.bytesForRun(learner,run.id,a.id,r.asset_id,r.asset_version);assert.deepEqual(Buffer.from(result.bytes),e.bytes);delivered++;}
      if(a.response.kind==='speech'){
        const j=await speech.create(learner,randomUUID(),{attempt_id:randomUUID(),language_profile_id:profileId,lesson_run_id:run.id,item_id:a.id,content_version_id:run.content_version_id});
        assert.equal(j.outcome,'speech_unavailable');run=await speech.next(learner,run.id,j.job_id);neutral++;continue;
      }
      if(!wrong&&a.stable_code.endsWith('SCENE-MORNING')){
        const bad=command(run,a,{kind:'single',option_id:'BYE'}),receipt=await lessons.submit(learner,run.id,bad);
        assert.equal(receipt.outcome,'incorrect');assert.equal((await lessons.submit(learner,run.id,bad)).replayed,true);
        run=await lessons.get(learner,run.id);assert.equal(run.current_activity_id,a.id);
        assert.equal((await lessons.submit(learner,run.id,command(run,a,{kind:'none'},true))).outcome,'assisted');wrong=true;
      }else await lessons.submit(learner,run.id,command(run,a));
      run=await lessons.get(learner,run.id);
    }
    assert(wrong);assert.equal(run.unresolved_count,0);assert.equal((await lessons.get(learner,run.id)).state,'completed');
    assert.equal(neutral,mode==='--real-l01'?2:0);
    assert.equal((await pool!.query("SELECT count(*) FROM evidence_events WHERE skill IN ('speaking','pronunciation')")).rows[0].count,'0');
    assert(Number((await pool!.query('SELECT count(*) FROM review_schedules WHERE language_profile_id=$1',[profileId])).rows[0].count)>0);
    assert.equal(delivered,unit.activities.reduce((n,a)=>n+a.presentation.media_refs.length,0));
    await assert.rejects(media.bytesForRun(author,run.id,unit.activities[0]!.id,entries[0]!.metadata.asset_id,entries[0]!.metadata.asset_version),{code:'NOT_FOUND'});
  });
  let browserExecuted=false;
  if(mode==='--svg-text-slice')await gate('mobile and desktop: real authored SVG/text lesson through Next/API/PostgreSQL/S3',async()=>{
    const users=[];
    for(const viewport of ['mobile','desktop']){const email=viewport+'-'+suffix+'@example.invalid',pass=randomBytes(32).toString('base64url'),id=await identity.provision(email,pass);
      const r=await lessons.start(id,{language_profile_id:await profile(id),publication_id:publicationId,lesson_id:unit.lesson_id});users.push({viewport,email,password:pass,run_id:r.id});}
    await l01BrowserGate(pool!,storage!.store(),users);browserExecuted=true;
  });
  assert.equal((await pool!.query("SELECT count(*) FROM publications WHERE channel<>'test'")).rows[0].count,'0');
  const paths=['content/english/m01/l01.json','packages/content-tools/src/authored-unit.ts','infra/persistence/authored-unit.ts','tools/p6/l01-input.ts','tools/p6/l01-postgres.ts','tools/p6/l01-browser-gate.ts','tools/p6/playwright.config.ts','tests/browser/p6-l01.spec.ts','tests/fixtures/p6/l01-test-slice.json','tests/support/p6-authored-slice.ts','infra/local/database-guard.ts','.github/workflows/p6.yml'];
  const report={status:'PASS',source_sha,mode,scope:unit.scope,activities:unit.activities.length,content_versions:unit.entities.length,media_pins:unit.media_pins,media_uses:delivered,postgresql_server_version:'180006',postgresql_executed:true,s3_executed:true,adapter_restarted:true,import_replayed:true,immutable_changes_rejected:true,browser_executed:browserExecuted,browser_projects:browserExecuted?['mobile','desktop']:[],neutral_speech_continues:neutral,full_audio_l01_executed:mode==='--real-l01',full_audio_browser_executed:false,production_profile_approved:false,production_publication_created:false,owner_content_approval_created:false,milestone_status:'NOT_READY',gates,test_server_revision:minioTestRevision,test_server_binary_sha256:storage.binary_sha256,code_bindings:Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])))};
  await mkdir('artifacts/p6',{recursive:true});await writeFile('artifacts/p6/'+(mode==='--real-l01'?'l01-real.json':'l01-svg-text.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,mode,source_sha,gates:gates.length,activities:unit.activities.length,media:unit.media_pins.length,browser:browserExecuted}));
}finally{
  await pool?.end();try{if(created)await admin.query('DROP DATABASE "'+name+'" WITH (FORCE)');}finally{await admin.end();await storage?.close();}
}
