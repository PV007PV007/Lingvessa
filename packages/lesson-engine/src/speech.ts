import type {SpeechResult,SpeechOutcome,SpeechReason,SpeechState} from '../../activity-schemas/src/speech.js';
export function terminalSpeech(state:SpeechState):boolean {return ['succeeded','unavailable','failed','cancelled','expired'].includes(state);}
export function classifySpeech(result:SpeechResult,threshold:number):{state:'succeeded'|'unavailable';outcome:SpeechOutcome;reason:SpeechReason}{
 if(!result.usable||result.confidence<threshold)return {state:'unavailable',outcome:'speech_unavailable',reason:'low_confidence'};
 return result.target_match?{state:'succeeded',outcome:'speech_correct',reason:'matched'}:{state:'succeeded',outcome:'speech_incorrect',reason:'target_mismatch'};
}
export type SpeechUiState='idle'|'permission_request'|'recording'|'processing'|SpeechOutcome;
export const speechUiTransitions:Record<SpeechUiState,readonly SpeechUiState[]>={
 idle:['permission_request','processing'],permission_request:['recording','processing','speech_unavailable'],recording:['processing','speech_unavailable'],
 processing:['speech_correct','speech_incorrect','speech_unavailable'],speech_correct:['permission_request','idle'],speech_incorrect:['permission_request','idle'],speech_unavailable:['permission_request','idle'],
};
export function transitionSpeech(from:SpeechUiState,to:SpeechUiState):SpeechUiState {
 if(from===to||speechUiTransitions[from].includes(to))return to;
 throw new TypeError(`Invalid speech UI transition ${from} -> ${to}`);
}
