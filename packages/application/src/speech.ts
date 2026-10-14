import type {SpeechResult} from '../../activity-schemas/src/speech.js';
export const SPEECH_LIMITS={maxBytes:5*1024*1024,maxRecordingMs:60000,ttlMs:14*60*1000,cleanupIntervalMs:1000,processingMs:15000,maxAttempts:3} as const;
export type SpeechPolicy={code:string;version:string;language:'en'|'cs';variety:string;target_feature:string;provider_code:string;model_version:string;confidence_threshold:number;test_only:boolean};
/** Raw bytes stay inside this transient boundary, never in attempts, result JSON, logs or object assets. */
export interface TransientSpeechStore {
 put(jobId:string,bytes:Uint8Array,expiresAt:Date):Promise<void>;
 read(jobId:string):Promise<Uint8Array>;
 delete(jobId:string):Promise<void>;
 prune():Promise<number>;
}
export interface SpeechEvaluator {
 readonly code:string;
 readonly modelVersion:string;
 readonly available:boolean;
 readonly testOnly?:boolean;
 readonly supportedFacets?:readonly string[];
 evaluate(input:{audio:Uint8Array;mime:string;language:'en'|'cs';variety:string;target_feature:string;signal:AbortSignal}):Promise<SpeechResult>;
}
