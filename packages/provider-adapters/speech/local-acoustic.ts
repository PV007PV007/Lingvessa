import {spawn} from 'node:child_process';
import type {ChildProcessWithoutNullStreams} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {SPEECH_LIMITS} from '../../application/src/speech.js';
import type {SpeechEvaluator} from '../../application/src/speech.js';
import {speechResultSchema} from '../../activity-schemas/src/speech.js';
import type {SpeechResult} from '../../activity-schemas/src/speech.js';
import {UUID_PATTERN} from '../../domain/src/identity.js';
const readySchema=z.object({ready:z.literal(true),provider:z.literal('local_acoustic_ipa'),model_version:z.literal('xlsr53-espeak-2c733782da56-1'),test_only:z.literal(true),network_denied:z.literal(true)}).strict();
const responseSchema=z.object({request_id:z.string().regex(UUID_PATTERN),result:speechResultSchema}).strict();
type Pending={id:string;resolve:(result:SpeechResult)=>void;reject:(error:Error)=>void};
export class LocalAcousticEvaluator implements SpeechEvaluator {
 readonly code='local_acoustic_ipa';readonly modelVersion='xlsr53-espeak-2c733782da56-1';readonly available=true;readonly testOnly=true;
 readonly supportedFacets=['pronunciation_target'] as const;
 private child:ChildProcessWithoutNullStreams|undefined;private boot:Promise<void>|undefined;private pending:Pending|undefined;private busy=false;private disposed=false;
 constructor(private readonly config:{python:string;engine:string;modelRoot:string}){}
 async warm():Promise<void>{
  if(this.disposed)throw new Error('SPEECH_PROVIDER_CLOSED');if(this.boot)return this.boot;
  const child=spawn(this.config.python,['-u',this.config.engine,'--model-root',this.config.modelRoot],{stdio:['pipe','pipe','pipe'],env:{PATH:process.env.PATH??'/usr/bin:/bin',LANG:'C.UTF-8',PYTHONDONTWRITEBYTECODE:'1',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1',DO_NOT_TRACK:'1',OMP_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2'}});
  this.child=child;child.stderr.resume();
  this.boot=new Promise<void>((resolve,reject)=>{
   let ready=false,buffer='';const timer=setTimeout(()=>fail(),30000);timer.unref();
   const fail=()=>{clearTimeout(timer);reject(new Error('SPEECH_PROVIDER_UNAVAILABLE'));if(this.child===child)this.stop(new Error('SPEECH_PROVIDER_UNAVAILABLE'));};
   child.once('error',fail);child.once('exit',fail);child.stdin.on('error',fail);child.stdout.on('error',fail);child.stderr.on('error',fail);
   child.stdout.on('data',(chunk:Buffer)=>{
    buffer+=chunk.toString('utf8');if(Buffer.byteLength(buffer)>8192){fail();return;}let end:number;
    while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);
     try{if(!ready){readySchema.parse(JSON.parse(line));ready=true;clearTimeout(timer);resolve();continue;}
      const response=responseSchema.parse(JSON.parse(line)),pending=this.pending;if(!pending||pending.id!==response.request_id)throw new Error('INVALID_PROVIDER_CONTEXT');
      this.pending=undefined;pending.resolve(response.result);
     }catch{fail();return;}
    }
   });
  });return this.boot;
 }
 async evaluate(input:Parameters<SpeechEvaluator['evaluate']>[0]):Promise<SpeechResult>{
  if(input.signal.aborted)throw new Error('SPEECH_PROVIDER_CANCELLED');
  if(!input.audio.length||input.audio.length>SPEECH_LIMITS.maxBytes)return {usable:false,confidence:0,target_match:false,error_tags:['UNSUPPORTED_AUDIO'],processing_ms:0};
  if(this.busy)throw new Error('SPEECH_PROVIDER_BUSY');this.busy=true;
  const abort=()=>this.stop(new Error('SPEECH_PROVIDER_CANCELLED'));input.signal.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>this.stop(new Error('SPEECH_PROVIDER_TIMEOUT')),SPEECH_LIMITS.processingMs);timer.unref();
  try{await this.warm();if(input.signal.aborted)throw new Error('SPEECH_PROVIDER_CANCELLED');
   return await new Promise<SpeechResult>((resolve,reject)=>{
    const id=randomUUID();this.pending={id,resolve,reject};const child=this.child;if(!child){this.pending=undefined;reject(new Error('SPEECH_PROVIDER_UNAVAILABLE'));return;}
    child.stdin.write(JSON.stringify({request_id:id,bytes:input.audio.length,mime:input.mime,language:input.language,variety:input.variety,target_feature:input.target_feature})+'\n');child.stdin.write(input.audio,error=>{if(error)this.stop(new Error('SPEECH_PROVIDER_UNAVAILABLE'));});
   });
  }finally{clearTimeout(timer);input.signal.removeEventListener('abort',abort);this.busy=false;}
 }
 close(){this.disposed=true;this.stop(new Error('SPEECH_PROVIDER_CLOSED'));}
 private stop(error:Error){const child=this.child;this.child=undefined;this.boot=undefined;const pending=this.pending;this.pending=undefined;pending?.reject(error);child?.stdin.destroy();child?.stdout.destroy();child?.stderr.destroy();child?.kill('SIGKILL');}
}
