import assert from 'node:assert/strict';
import {readFile,realpath} from 'node:fs/promises';
import {isAbsolute,relative} from 'node:path';
import {compileAuthoredUnit,verifyAuthoredMedia} from '../../packages/content-tools/src/authored-unit.js';
import {loadMediaLibrary} from '../p5/media-library.js';
import {l01TestSlice} from '../../tests/support/p6-authored-slice.js';
export async function loadL01(mode:'--real-l01'|'--svg-text-slice'){
  const raw=JSON.parse(await readFile('content/english/m01/l01.json','utf8'));
  const compiled=compileAuthoredUnit(mode==='--real-l01'?raw:l01TestSlice(raw));
  let externalAudioRoot:string|undefined;
  if(mode==='--real-l01'){
    const input=process.env.P5_M01_AUDIO_ROOT;if(!input||!isAbsolute(input))throw new Error('Absolute external P5_M01_AUDIO_ROOT required; no fallback');
    const path=relative(await realpath(process.cwd()),await realpath(input));
    if(!path||(!path.startsWith('../')&&!isAbsolute(path)))throw new Error('Final WAV corpus must remain outside the Git checkout');
    externalAudioRoot=input;
  }
  const library=await loadMediaLibrary(process.cwd(),externalAudioRoot?{externalAudioRoot}:{metadataOnly:true});
  if(externalAudioRoot)assert.equal(library.entries.filter(e=>e.metadata.kind==='audio').length,420);
  const selected=new Set(compiled.unit.media_pins.map(p=>p.asset_id)),entries=library.entries.filter(e=>selected.has(e.metadata.asset_id));
  verifyAuthoredMedia(compiled.unit,entries.map(e=>e.metadata));
  for(const e of entries)assert.equal(e.bytes.length,e.metadata.byte_length,'Selected assets require real bytes');
  return {...compiled,library,entries};
}
