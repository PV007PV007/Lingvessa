import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import type {ChildProcess} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {isAbsolute,join} from 'node:path';
import {S3AssetStore,signedS3Headers} from '../../packages/provider-adapters/storage/s3.js';
import {waitForS3FixtureReady} from './fixture-readiness.js';

export const minioTestRevision='9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a';
/** Disposable loopback fixture; never selects a production storage/CDN profile. */
export async function s3TestFixture(){
 const binary=process.env.MINIO_BINARY;
 if(!binary||!isAbsolute(binary))throw new Error('Absolute pinned MINIO_BINARY required');
 const build=execFileSync(process.env.GO_BINARY??'go',['version','-m',binary],{encoding:'utf8'});
 assert(build.includes('github.com/minio/minio')&&build.includes(minioTestRevision.slice(0,12)),'Pinned test-server revision required');
 const reserve=createServer();await new Promise<void>(resolve=>reserve.listen(0,'127.0.0.1',resolve));
 const address=reserve.address();assert(address&&typeof address==='object');
 const port=address.port;await new Promise<void>(resolve=>reserve.close(()=>resolve()));
 const root=await mkdtemp(join(tmpdir(),'p5-library-s3-'));
 const config={endpoint:'http://127.0.0.1:'+port,region:'us-east-1',bucket:'p5-private-library',accessKey:randomBytes(16).toString('hex'),secretKey:randomBytes(32).toString('hex'),allowLoopbackHttp:true,timeoutMs:5000};
 let child:ChildProcess|undefined;
 const running=()=>child!==undefined&&child.exitCode===null&&child.signalCode===null;
 const start=async()=>{
  assert(!running());
  child=spawn(binary,['server',join(root,'data'),'--address','127.0.0.1:'+port],{env:{...process.env,MINIO_ROOT_USER:config.accessKey,MINIO_ROOT_PASSWORD:config.secretKey,MINIO_BROWSER:'off',MINIO_UPDATE:'off'},stdio:'ignore'});
  let spawnError=false;child.on('error',()=>{spawnError=true;});
  await waitForS3FixtureReady(async()=>{
   if(spawnError||!running())throw new Error('Pinned S3 fixture could not start; no fixture substitution');
   let response:Response;const target=new URL(config.endpoint+'/');
   try{response=await fetch(target,{headers:signedS3Headers(config,'GET',target,new Uint8Array()),signal:AbortSignal.timeout(500)});}catch{return null;}
   const status=response.status;await response.body?.cancel();return status;
  });
 };
 const stop=async()=>{
  if(!running()){child=undefined;return;}const current=child!;
  await new Promise<void>((resolve,reject)=>{
   const timer=setTimeout(()=>{current.kill('SIGKILL');reject(new Error('S3 fixture shutdown timeout'));},5000);
   current.once('exit',()=>{clearTimeout(timer);resolve();});current.kill('SIGTERM');
  });child=undefined;
 };
 const close=async()=>{try{await stop();}finally{await rm(root,{recursive:true,force:true});}};
 try{
  await start();const target=new URL(config.endpoint+'/'+config.bucket),empty=new Uint8Array();
  const response=await fetch(target,{method:'PUT',headers:signedS3Headers(config,'PUT',target,empty),body:Buffer.from(empty),signal:AbortSignal.timeout(5000)});
  await response.body?.cancel();assert.equal(response.status,200);
  return {config,start,stop,close,store:()=>new S3AssetStore(config),binary_sha256:createHash('sha256').update(await readFile(binary)).digest('hex')};
 }catch(error){await close();throw error;}
}
