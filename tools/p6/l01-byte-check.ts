import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {loadL01} from './l01-input.js';
// Read-only byte verification, explicitly separate from the PostgreSQL/S3 execution gate.
const {unit,entries,library}=await loadL01('--real-l01');
const audio=library.entries.filter(e=>e.metadata.kind==='audio');
const singles=audio.filter(e=>e.metadata.turns?.length===1),dialogues=audio.filter(e=>(e.metadata.turns?.length??0)>1);
const byLanguage=(rows:typeof audio)=>({en:rows.filter(e=>e.metadata.scope.language==='en').length,cs:rows.filter(e=>e.metadata.scope.language==='cs').length});
const pilotPath='docs/p5/integration-20261015/external-m01-byte-validation.json',pilot=JSON.parse(await readFile(pilotPath,'utf8'));
assert.equal(pilot.status,'PASS');assert.equal(audio.length,pilot.files);assert.equal(singles.length,pilot.pilot_files);assert.equal(dialogues.length,pilot.pilot_excludes_dialogue_files);
assert.equal(singles.length+dialogues.length,audio.length);assert.deepEqual(byLanguage(singles),{en:202,cs:200});assert.deepEqual(byLanguage(dialogues),{en:8,cs:10});
const paths=['content/english/m01/l01.json','tools/p6/l01-input.ts','tools/p6/l01-byte-check.ts','packages/content-tools/src/authored-unit.ts','tools/p5/media-library.ts','packages/provider-adapters/storage/asset-integrity.ts','assets/media/m01/registry.json',pilotPath];
const report={status:'LOCAL_BYTE_CHECK_PASS_ONLY',verified_final_wavs:audio.length,acoustic_single_turn_results:singles.length,assembled_dialogues:dialogues.length,final_counts:byLanguage(audio),single_turn_counts:byLanguage(singles),dialogue_counts:byLanguage(dialogues),selected_wavs:entries.filter(e=>e.metadata.kind==='audio').length,selected_svgs:entries.filter(e=>e.metadata.kind!=='audio').length,media_uses:unit.activities.reduce((n,a)=>n+a.presentation.media_refs.length,0),pins:unit.media_pins,postgresql_executed:false,s3_executed:false,browser_executed:false,production_profile_approved:false,code_bindings:Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])))};
await mkdir('artifacts/p6',{recursive:true});await writeFile('artifacts/p6/l01-local-byte-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,verified_final_wavs:report.verified_final_wavs,selected_wavs:report.selected_wavs,selected_svgs:report.selected_svgs}));
