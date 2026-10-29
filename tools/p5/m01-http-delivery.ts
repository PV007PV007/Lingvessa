import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import type pg from 'pg';
import {createApi} from '../../apps/api/src/app.js';
import {IdentityRepository} from '../../infra/persistence/identity.js';
import {ContentRepository} from '../../infra/persistence/content.js';
import {LessonRepository} from '../../infra/persistence/lessons.js';
import {MediaRepository} from '../../infra/persistence/media.js';
import type {LoadedMediaLibrary} from './media-library.js';
import type {s3TestFixture} from './s3-test-fixture.js';

export interface M01HttpTarget {language:'en'|'cs';run_id:string;item_id:string;entries:LoadedMediaLibrary['entries']}

/** Actual loopback HTTP against the recovered PostgreSQL pool and real private S3 bytes. */
export async function verifyM01HttpDelivery(pool:pg.Pool,storage:Awaited<ReturnType<typeof s3TestFixture>>,learner:string,targets:M01HttpTarget[]){
 assert.equal(targets.length,2);assert.equal(targets.flatMap(t=>t.entries).length,450);
 const store=storage.store(),media=new MediaRepository(pool,store);
 const app=await createApi({ready:async()=>true,close:async()=>undefined},{identity:new IdentityRepository(pool),content:new ContentRepository(pool,store),lessons:new LessonRepository(pool),media});
 let full=0,audio=0,visual=0,ranges=0,denials=0,outages=0,recovered=0;
 await app.listen(0,'127.0.0.1');
 try{
  const origin=await app.getUrl();
  const login=async(role:'learner'|'author')=>{
   const response=await fetch(origin+'/api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json','x-lingvessa-client':'web'},body:JSON.stringify({email:`p5-${role}@example.invalid`,password:`Synthetic P5 ${role} password!`})});
   assert.equal(response.status,200);await response.json();
   const cookie=response.headers.get('set-cookie');assert(cookie);assert(cookie.includes('; Secure; HttpOnly; SameSite=Strict;'));
   // Secure cookies are passed manually only in this disposable loopback HTTP test.
   return {cookie:cookie.split(';')[0]!};
  };
  const owner=await login('learner'),foreign=await login('author');
  const route=(t:M01HttpTarget)=>`${origin}/api/v1/lesson-runs/${t.run_id}/media`;
  const file=(t:M01HttpTarget,e:LoadedMediaLibrary['entries'][number],item=t.item_id,version=e.metadata.asset_version)=>`${route(t)}/${e.metadata.asset_id}/${version}?item_id=${item}`;
  const denial=async(url:string,status:number,headers:Record<string,string>={})=>{
   const response=await fetch(url,{headers});assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'private, no-store');
   const problem=await response.json() as {status:number};assert.equal(problem.status,status);denials++;
  };
  for(const target of targets){
   const response=await fetch(route(target)+'?item_id='+target.item_id,{headers:owner});assert.equal(response.status,200);
   assert.equal(response.headers.get('cache-control'),'private, no-store');
   const list=await response.json();assert.deepEqual(list,await media.forRun(learner,target.run_id,target.item_id));
   assert(!JSON.stringify(list).includes('provider_external_id'));
   for(const entry of target.entries){
    const response=await fetch(file(target,entry),{headers:owner}),m=entry.metadata;
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.equal(response.headers.get('content-type')?.split(';')[0],m.mime);assert.equal(response.headers.get('content-length'),String(m.byte_length));
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('accept-ranges'),'bytes');
    if(m.mime==='image/svg+xml')assert.equal(response.headers.get('content-security-policy'),"default-src 'none'; sandbox");
    const bytes=Buffer.from(await response.arrayBuffer());assert.deepEqual(bytes,entry.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),m.checksum);full++;
    if(m.kind==='audio')audio++;else visual++;
   }
   for(const speed of ['normal','slow']){
    const entry=target.entries.find(e=>e.metadata.kind==='audio'&&e.metadata.speed===speed)!;
    for(const [range,start,end] of [['bytes=0-43',0,43],['bytes=-16',entry.bytes.length-16,entry.bytes.length-1]] as const){
     const response=await fetch(file(target,entry),{headers:{...owner,range}});assert.equal(response.status,206);
     assert.equal(response.headers.get('content-range'),`bytes ${start}-${end}/${entry.bytes.length}`);
     assert.deepEqual(Buffer.from(await response.arrayBuffer()),entry.bytes.subarray(start,end+1));ranges++;
    }
   }
   const entry=target.entries[0]!,url=file(target,entry),other=targets.find(t=>t.language!==target.language)!.entries[0]!;
   await denial(url,401);await denial(url,401,{cookie:'__Host-lingvessa_session=invalid'});
   await denial(url,404,foreign);await denial(file(target,entry,randomUUID()),404,owner);
   await denial(file(target,other),404,owner);await denial(file(target,entry,target.item_id,entry.metadata.asset_version+1),404,owner);
   for(const range of ['bytes=-','bytes=0-1,4-5','bytes=999999999-'])await denial(url,416,{...owner,range});
  }
  // Exercise failure and recovery through the still-running HTTP service, not only the repository.
  await storage.stop();
  for(const target of targets){await denial(file(target,target.entries[0]!),503,owner);outages++;}
  await storage.start();
  for(const target of targets){const entry=target.entries[0]!,response=await fetch(file(target,entry),{headers:owner});assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),entry.bytes);recovered++;}
  assert.equal(full,450);assert.equal(audio,420);assert.equal(visual,30);assert.equal(ranges,8);assert.equal(denials,20);
  return {status:'PASS',executed:true,scope:'REAL_M01_LOOPBACK_HTTP_POSTGRESQL_S3_NOT_PRODUCTION_CDN',metadata_lists:2,full_assets:full,audio_assets:audio,visual_assets:visual,
   byte_ranges:ranges,negative_responses:denials,storage_outage_503:outages,storage_recovery_reads:recovered,authenticated_login:true,all_full_response_checksums_verified:true,
   private_no_store_headers_verified:true,svg_sandbox_headers_verified:true,production_delivery_profile_approved:false};
 }finally{await app.close();}
}
