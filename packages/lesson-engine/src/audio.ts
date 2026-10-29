/** Timing is in the original media timeline; changing playback rate must not rescale cue times. */
export function activeAudioTurn(turns:readonly {start_ms:number;end_ms:number}[],currentTimeSeconds:number):number|null {
 if(!Number.isFinite(currentTimeSeconds)||currentTimeSeconds<0)return null;
 const time=currentTimeSeconds*1000,index=turns.findIndex(t=>time>=t.start_ms&&time<t.end_ms);return index<0?null:index;
}
