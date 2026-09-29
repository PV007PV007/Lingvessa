import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EncryptedTransientSpeechStore,uploadToken,validUploadToken} from '../../packages/provider-adapters/speech/transient.js';
import {speechSignature,verifySpeechCallback} from '../../packages/provider-adapters/speech/callback.js';
import {classifySpeech,transitionSpeech} from '../../packages/lesson-engine/src/speech.js';
import {speechRuntime} from '../../infra/config/speech.js';

test('P5 speech target decisions distinguish mismatch from unusable speech',()=>{
 const usable={usable:true,confidence:0.9,target_match:true,error_tags:[],processing_ms:20};
 assert.equal(classifySpeech(usable,0.8).outcome,'speech_correct');assert.equal(classifySpeech({...usable,target_match:false},0.8).outcome,'speech_incorrect');
 for(const result of [{...usable,usable:false},{...usable,confidence:0.1}])assert.equal(classifySpeech(result,0.8).outcome,'speech_unavailable');
 assert.equal(transitionSpeech('processing','speech_incorrect'),'speech_incorrect');assert.throws(()=>transitionSpeech('recording','speech_correct'));
 assert.equal(speechRuntime({}).evaluator.available,false);assert.throws(()=>speechRuntime({SPEECH_TRANSIENT_MODE:'tmpfs'}));
});
test('P5 raw audio is encrypted on private tmpfs, tamper bound, deleted on TTL and never accepted on permanent fs',async()=>{
 const root=await mkdtemp('/dev/shm/lingvessa-speech-'),persistent=await mkdtemp(join(tmpdir(),'speech-denied-')),key=randomBytes(32),store=new EncryptedTransientSpeechStore(root,key),id=randomUUID(),bytes=Buffer.from('synthetic speech bytes');
 try{
  const expiry=new Date(Date.now()+5000);await store.put(id,bytes,expiry);assert.deepEqual(await store.read(id),bytes);
  const path=join(root,id+'.speech'),disk=await readFile(path);assert(!disk.includes(bytes));await assert.rejects(store.put(id,bytes,expiry));
  disk[disk.length-1]=disk[disk.length-1]!^1;await writeFile(path,disk);await assert.rejects(store.read(id));await store.delete(id);await store.delete(id);
  const short=randomUUID();await store.put(short,bytes,new Date(Date.now()+40));await new Promise(r=>setTimeout(r,60));assert.equal(await store.prune(),1);assert.deepEqual(await readdir(root),[]);
  await assert.rejects(new EncryptedTransientSpeechStore(persistent,key).put(randomUUID(),bytes,expiry),/memory filesystem/);
  const token=uploadToken(key,id,short,expiry);assert(validUploadToken(key,id,short,expiry,token));assert(!validUploadToken(key,id,randomUUID(),expiry,token));assert(!validUploadToken(key,id,short,new Date(0),token));
 }finally{await rm(root,{recursive:true,force:true});await rm(persistent,{recursive:true,force:true});}
});
test('P5 callbacks authenticate exact bytes, origin, timestamp and structured context',()=>{
 const secret=randomBytes(32),origin='internal-speech-worker',now=Date.now(),timestamp=String(now),payload={event_id:randomUUID(),job_id:randomUUID(),execution_id:randomUUID(),user_id:randomUUID(),language_profile_id:randomUUID(),language_id:randomUUID(),provider_code:'controlled_speech_fixture',model_version:'fixture-1',policy_code:'TARGET',policy_version:'fixture-1',result:{usable:true,confidence:0.9,target_match:false,error_tags:[],processing_ms:20}},body=JSON.stringify(payload),signature=speechSignature(secret,origin,timestamp,body);
 assert.deepEqual(verifySpeechCallback(secret,origin,origin,timestamp,signature,body,now),payload);
 for(const args of [[origin,timestamp,signature,body+' '],['other',timestamp,signature,body],[origin,String(now-300001),signature,body]])assert.throws(()=>verifySpeechCallback(secret,origin,args[0]!,args[1]!,args[2]!,args[3]!,now));
});
