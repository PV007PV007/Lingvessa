import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {ConfigurationError} from './runtime.js';
import {EncryptedTransientSpeechStore,UnavailableTransientSpeechStore} from '../../packages/provider-adapters/speech/transient.js';
import {unavailableSpeechEvaluator} from '../../packages/provider-adapters/speech/unavailable.js';
import {LocalAcousticEvaluator} from '../../packages/provider-adapters/speech/local-acoustic.js';
const schema=z.object({LINGVESSA_ENV:z.string().optional(),SPEECH_EVALUATOR_MODE:z.enum(['unavailable','local_acoustic_candidate']).default('unavailable'),SPEECH_ACOUSTIC_PYTHON:z.string().startsWith('/').optional(),SPEECH_ACOUSTIC_MODEL_ROOT:z.string().startsWith('/').optional(),SPEECH_TRANSIENT_MODE:z.enum(['unavailable','tmpfs']).default('unavailable'),SPEECH_TRANSIENT_ROOT:z.string().startsWith('/').optional(),SPEECH_TRANSIENT_KEY:z.string().regex(/^[a-f0-9]{64}$/u).optional(),SPEECH_UPLOAD_KEY:z.string().regex(/^[a-f0-9]{64}$/u).optional()}).superRefine((c,ctx)=>{
 if(c.SPEECH_TRANSIENT_MODE==='tmpfs')for(const key of ['SPEECH_TRANSIENT_ROOT','SPEECH_TRANSIENT_KEY','SPEECH_UPLOAD_KEY'] as const)if(!c[key])ctx.addIssue({code:'custom',path:[key],message:'Required'});
 if(c.SPEECH_EVALUATOR_MODE==='local_acoustic_candidate'){
  if(c.LINGVESSA_ENV!=='local')ctx.addIssue({code:'custom',path:['SPEECH_EVALUATOR_MODE'],message:'Candidate requires local scope'});
  for(const key of ['SPEECH_ACOUSTIC_PYTHON','SPEECH_ACOUSTIC_MODEL_ROOT'] as const)if(!c[key])ctx.addIssue({code:'custom',path:[key],message:'Required'});
 }
});
export function speechRuntime(env:NodeJS.ProcessEnv){
 const parsed=schema.safeParse(env);if(!parsed.success)throw new ConfigurationError([...new Set(parsed.error.issues.map(i=>String(i.path[0]??'speech')))]);
 const c=parsed.data,evaluator=c.SPEECH_EVALUATOR_MODE==='local_acoustic_candidate'?new LocalAcousticEvaluator({python:c.SPEECH_ACOUSTIC_PYTHON!,modelRoot:c.SPEECH_ACOUSTIC_MODEL_ROOT!,engine:fileURLToPath(new URL('../../tools/p5/acoustic-engine.py',import.meta.url))}):unavailableSpeechEvaluator;
 return {audio:c.SPEECH_TRANSIENT_MODE==='tmpfs'?new EncryptedTransientSpeechStore(c.SPEECH_TRANSIENT_ROOT!,Buffer.from(c.SPEECH_TRANSIENT_KEY!,'hex')):new UnavailableTransientSpeechStore(),evaluator,uploadKey:c.SPEECH_UPLOAD_KEY?Buffer.from(c.SPEECH_UPLOAD_KEY,'hex'):randomBytes(32),warm:async()=>{if(evaluator instanceof LocalAcousticEvaluator)await evaluator.warm();},close:()=>{if(evaluator instanceof LocalAcousticEvaluator)evaluator.close();}};
}
