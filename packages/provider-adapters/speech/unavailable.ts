import type {SpeechEvaluator} from '../../application/src/speech.js';
export const unavailableSpeechEvaluator:SpeechEvaluator={code:'unavailable',modelVersion:'none',available:false,async evaluate(){throw new Error('SPEECH_PROVIDER_UNAVAILABLE');}};
