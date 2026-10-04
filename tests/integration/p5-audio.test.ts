import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
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
import {createApi} from '../../apps/api/src/app.js';
import {p5AudioFixture} from '../support/p5-audio-fixtures.js';
import {p5BrowserGate} from '../../tools/p5/browser-gate.js';

test('P5 audio: published delivery, ownership, byte ranges, support and normal/slow speaker timing',{timeout:240000},async()=>{
 const base=localDatabaseUrl(process.env),admin=new pg.Client({connectionString:base}),name=`lingvessa_p5_test_${randomBytes(8).toString('hex')}`,url=new URL(base);url.pathname=`/${name}`;
 const env={...process.env,LINGVESSA_ENV:'local',DATABASE_URL:url.toString()},root=await mkdtemp(join(tmpdir(),'p5-audio-'));let created=false,pool:pg.Pool|undefined;
 const gates:Array<{gate:string;status:'PASS'}>=[],gate=async(id:string,fn:()=>Promise<void>)=>{await fn();gates.push({gate:id,status:'PASS'});console.log('P5_GATE PASS',id);};
 try{
  await admin.connect();assert.equal((await admin.query('SHOW server_version_num')).rows[0].server_version_num,'180006');await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0 ENCODING 'UTF8'`);created=true;
  const migration=spawnSync('pnpm',['db:migrate'],{env,encoding:'utf8',timeout:60000});assert.equal(migration.status,0,migration.stdout.slice(-1500)+migration.stderr.slice(-1000));await seedBootstrap(env);
  pool=createFoundationPool(url.toString());const db=pool,f=await p5AudioFixture(db,new LocalAssetStore(root));
  await gate('P5-AUDIO-DB-001 published pins preserve normal/slow script, language and voice',async()=>{
   for(const language of ['en','cs'] as const){const list=await f.media.forRun(f.learner,f.runs[language].id,f.audio[language].itemId);assert.equal(list.length,4);assert(list.every(a=>a.scope.language===language));
    const slow=list.find(a=>a.speed==='slow')!;assert.equal(slow.normal_asset_id,f.audio[language].normal.asset_id);assert.equal(slow.turns![1]!.start_ms,6000);assert(!JSON.stringify(list).includes('provider_external_id'));
    assert.deepEqual(slow.turns!.map(t=>t.turn_id),list.find(a=>a.speed==='normal')!.turns!.map(t=>t.turn_id));
    const avatars=list.filter(a=>a.kind==='avatar');assert.equal(avatars.length,2);
    for(const turn of slow.turns!)assert(avatars.some(a=>a.character_id===turn.character_id&&a.character_version_code===turn.character_version_code));
    const refs=list.map(a=>({asset_id:a.asset_id,asset_version:a.asset_version}));
    const closure=async(values:typeof refs,lang=f.sources[language].language_id)=>(await db.query('SELECT p5_avatar_closure($1::jsonb,$2::uuid) AS ok',[JSON.stringify(values),lang])).rows[0].ok;
    assert.equal(await closure(refs),true);assert.equal(await closure(refs.filter(r=>r.asset_id!==avatars[0]!.asset_id)),false);
    const foreignAvatar=(await f.media.forRun(f.learner,f.runs[language==='en'?'cs':'en'].id,f.audio[language==='en'?'cs':'en'].itemId)).find(a=>a.kind==='avatar')!;
    assert.equal(await closure([...refs.filter(r=>r.asset_id!==avatars[0]!.asset_id),{asset_id:foreignAvatar.asset_id,asset_version:foreignAvatar.asset_version}]),false);
   }
   await assert.rejects(f.media.forRun(f.author,f.runs.en.id,f.audio.en.itemId),/not found/);
   await assert.rejects(f.media.forRun(f.learner,f.runs.en.id,f.audio.cs.itemId),/not in/);
   await assert.rejects(f.media.bytesForRun(f.learner,f.runs.en.id,f.audio.en.itemId,f.audio.cs.normal.asset_id,1),/not in/);
   await assert.rejects(db.query("UPDATE voices SET metadata='{}' WHERE id=$1",[f.audio.en.voiceId]),{code:'23514'});
   await assert.rejects(db.query('UPDATE asset_versions SET metadata=$1 WHERE asset_id=$2',[{},f.audio.en.normal.asset_id]),{code:'23514'});
  });
  const app=await createApi({ready:async()=>true,close:async()=>undefined},{identity:f.identity,content:f.content,lessons:f.lessons,media:f.media});await app.listen(0,'127.0.0.1');
  try{
   const origin=await app.getUrl(),route=`${origin}/api/v1/lesson-runs/${f.runs.en.id}/media`,query=`?item_id=${f.audio.en.itemId}`,session=await f.identity.login('p5-learner@example.invalid','Synthetic P5 learner password!');
   const headers={cookie:`__Host-lingvessa_session=${session.token}`},asset=f.audio.en.normal;
   await gate('P5-AUDIO-API-001 authenticated immutable byte range and invalid-range rejection',async()=>{
    assert.equal((await fetch(route+query)).status,401);assert.equal((await fetch(route+query,{headers})).status,200);
    const file=`${route}/${asset.asset_id}/1${query}`,full=await fetch(file,{headers});assert.equal(full.status,200);assert.equal((await full.arrayBuffer()).byteLength,asset.byte_length);assert.equal(full.headers.get('cache-control'),'private, no-store');
    const part=await fetch(file,{headers:{...headers,range:'bytes=0-43'}});assert.equal(part.status,206);assert.equal(part.headers.get('content-range'),`bytes 0-43/${asset.byte_length}`);assert.equal((await part.arrayBuffer()).byteLength,44);
    assert.equal((await fetch(file,{headers:{...headers,range:'bytes=999999999-'}})).status,416);
    assert.equal((await fetch(`${route}/${f.audio.cs.normal.asset_id}/1${query}`,{headers})).status,404);
    assert.equal((await fetch(`${route}/${asset.asset_id}/2${query}`,{headers})).status,404);
   });
   await gate('P5-AUDIO-API-002 transcript support is CSRF protected, idempotent and never mastery evidence',async()=>{
    const body=JSON.stringify({item_id:f.audio.en.itemId,kind:'transcript'}),post=(csrf?:string)=>fetch(route+'/support',{method:'POST',headers:{...headers,'content-type':'application/json',...(csrf?{'x-csrf-token':csrf}:{})},body});
    assert.equal((await post()).status,403);assert.equal((await post(session.csrf)).status,204);assert.equal((await post(session.csrf)).status,204);
    assert.equal((await db.query("SELECT count(*) FROM audit_events WHERE action='media.transcript_opened' AND target_id=$1",[f.runs.en.id])).rows[0].count,'1');
    assert.equal((await db.query('SELECT count(*) FROM evidence_events WHERE user_id=$1',[f.learner])).rows[0].count,'0');
    assert.equal((await fetch(route+'/support',{method:'POST',headers:{...headers,'content-type':'application/json','x-csrf-token':session.csrf},body:JSON.stringify({item_id:randomUUID(),kind:'transcript'})})).status,404);
   });
   if(process.env.P5_BROWSER_TESTS==='true')await gate('P5-AUDIO-UI-001 Chromium normal/slow/play/pause/replay/speakers/fallback in EN and CS',()=>p5BrowserGate(origin,f.runs.en.id,f.runs.cs.id));
  }finally{await app.close();}
  mkdirSync('artifacts/p5',{recursive:true});writeFileSync('artifacts/p5/audio-validation.json',JSON.stringify({phase:'P5',task:'IMP-P5-002',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source_sha:process.env.GITHUB_HEAD_SHA??null,status:'PASS',browser_executed:process.env.P5_BROWSER_TESTS==='true',synthetic_tones_not_reference_speech:true,gates},null,2)+'\n');
 }finally{await pool?.end();if(created)await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end();await rm(root,{recursive:true,force:true});}
});
