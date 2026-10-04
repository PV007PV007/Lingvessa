import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import type {ChildProcess} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {mkdtemp,mkdir,rm,writeFile,readFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {S3AssetStore,signedS3Headers} from '../../packages/provider-adapters/storage/s3.js';
import {assetObjectKey} from '../../packages/provider-adapters/storage/asset-integrity.js';
import {svgAsset} from '../../tests/support/p5-fixtures.js';
import {waitForS3FixtureReady} from './fixture-readiness.js';

// A pinned standalone protocol test server, not approval of a production provider/CDN.
const sourceRevision='9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a';
const binary=process.env.MINIO_BINARY;if(!binary)throw new Error('Actual S3-compatible test server binary required');
const root=await mkdtemp(join(tmpdir(),'lingvessa-s3-'));
const reserve=createServer();await new Promise<void>(r=>reserve.listen(0,'127.0.0.1',r));const address=reserve.address();assert(address&&typeof address==='object');const port=address.port;await new Promise<void>(r=>reserve.close(()=>r()));
const accessKey=randomBytes(16).toString('hex'),secretKey=randomBytes(32).toString('hex');
const config={endpoint:`http://127.0.0.1:${port}`,region:'us-east-1',bucket:'p5-private-media',accessKey,secretKey,allowLoopbackHttp:true,timeoutMs:1500};
const store=new S3AssetStore(config),gates:Array<{gate:string;status:'PASS'}>=[];let child:ChildProcess|undefined;
const startupReadiness:Array<Awaited<ReturnType<typeof waitForS3FixtureReady>>>=[];
const start=async()=>{
 child=spawn(binary,['server',join(root,'data'),'--address',`127.0.0.1:${port}`],{env:{...process.env,MINIO_ROOT_USER:accessKey,MINIO_ROOT_PASSWORD:secretKey,MINIO_BROWSER:'off',MINIO_UPDATE:'off'},stdio:'ignore'});
 let spawnError=false;child.on('error',()=>{spawnError=true;});
 const readiness=await waitForS3FixtureReady(async()=>{
  if(spawnError||child?.exitCode!==null)throw new Error('S3 test server failed to start');
  const url=new URL(config.endpoint+'/');
  let response:Response;
  try{response=await fetch(url,{headers:signedS3Headers(config,'GET',url,new Uint8Array()),signal:AbortSignal.timeout(500)});}
  catch{return null;}
  const status=response.status;await response.body?.cancel();return status;
 });
 startupReadiness.push(readiness);
};
const stop=async()=>{if(!child||child.exitCode!==null)return;const current=child;await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{current.kill('SIGKILL');reject(new Error('S3 shutdown timeout'));},5000);current.once('exit',()=>{clearTimeout(timer);resolve();});current.kill('SIGTERM');});child=undefined;};
try{
 await start();const url=new URL(config.endpoint+'/'+config.bucket),empty=new Uint8Array();
 const create=await fetch(url,{method:'PUT',headers:signedS3Headers(config,'PUT',url,empty),body:Buffer.from(empty),signal:AbortSignal.timeout(2000)});assert.equal(create.status,200);
 const {metadata:a,bytes}=svgAsset('en'),key=assetObjectKey(a.asset_id,1,a.checksum);
 assert.equal((await fetch(config.endpoint+'/'+config.bucket+'/'+key)).status,403,'No anonymous object access');
 const writes=await Promise.all([store.putImmutable(key,bytes,a.mime,a.checksum),store.putImmutable(key,bytes,a.mime,a.checksum)]);assert.deepEqual(writes[0],writes[1]);
 assert.deepEqual(Buffer.from(await store.readVerified(key,a.checksum,a.byte_length)),bytes);gates.push({gate:'P5-S3-001 actual SigV4 PUT/HEAD/GET, immutable concurrent replay and private bucket',status:'PASS'});
 await assert.rejects(new S3AssetStore({...config,secretKey:'wrong-synthetic-secret'}).inspect(key));
 await assert.rejects(store.readVerified(key,'0'.repeat(64),a.byte_length));await assert.rejects(store.readVerified(key,a.checksum,10));gates.push({gate:'P5-S3-002 authentication, byte integrity and bounded reads',status:'PASS'});
 await stop();await assert.rejects(store.inspect(key));await start();assert.deepEqual(Buffer.from(await store.readVerified(key,a.checksum,a.byte_length)),bytes);gates.push({gate:'P5-S3-003 outage, restart and immutable stored bytes recovery',status:'PASS'});
 const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.equal(commit,process.env.GITHUB_HEAD_SHA);
 await mkdir('artifacts/p5',{recursive:true});await writeFile('artifacts/p5/storage-validation.json',JSON.stringify({phase:'P5',scope:'S3 protocol adapter with synthetic local test server only',status:'PASS',commit,gates,startup_readiness:startupReadiness,source_revision:sourceRevision,binary_sha256:createHash('sha256').update(await readFile(binary)).digest('hex'),production_provider_approved:false,raw_learner_data_used:false},null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',gates}));
}finally{await stop();await rm(root,{recursive:true,force:true});}
