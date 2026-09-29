import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {ConfigurationError} from './runtime.js';
import {EncryptedTransientSpeechStore,UnavailableTransientSpeechStore} from '../../packages/provider-adapters/speech/transient.js';
import {unavailableSpeechEvaluator} from '../../packages/provider-adapters/speech/unavailable.js';
const schema=z.object({SPEECH_TRANSIENT_MODE:z.enum(['unavailable','tmpfs']).default('unavailable'),SPEECH_TRANSIENT_ROOT:z.string().startsWith('/').optional(),SPEECH_TRANSIENT_KEY:z.string().regex(/^[a-f0-9]{64}$/u).optional(),SPEECH_UPLOAD_KEY:z.string().regex(/^[a-f0-9]{64}$/u).optional()}).superRefine((c,ctx)=>{if(c.SPEECH_TRANSIENT_MODE==='tmpfs')for(const key of ['SPEECH_TRANSIENT_ROOT','SPEECH_TRANSIENT_KEY','SPEECH_UPLOAD_KEY'] as const)if(!c[key])ctx.addIssue({code:'custom',path:[key],message:'Required'});});
/** OD-005/006 unresolved: no production evaluator or callback is implicitly enabled. */
export function speechRuntime(env:NodeJS.ProcessEnv){
 const parsed=schema.safeParse(env);if(!parsed.success)throw new ConfigurationError([...new Set(parsed.error.issues.map(i=>String(i.path[0]??'speech')))]);
 const c=parsed.data;
 return {audio:c.SPEECH_TRANSIENT_MODE==='tmpfs'?new EncryptedTransientSpeechStore(c.SPEECH_TRANSIENT_ROOT!,Buffer.from(c.SPEECH_TRANSIENT_KEY!,'hex')):new UnavailableTransientSpeechStore(),evaluator:unavailableSpeechEvaluator,uploadKey:c.SPEECH_UPLOAD_KEY?Buffer.from(c.SPEECH_UPLOAD_KEY,'hex'):randomBytes(32)};
}
