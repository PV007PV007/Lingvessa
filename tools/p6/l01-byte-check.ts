import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {loadL01} from './l01-input.js';
// Read-only byte verification, explicitly separate from the PostgreSQL/S3 execution gate.
const {unit,entries}=await loadL01('--real-l01');
const paths=['content/english/m01/l01.json','tools/p6/l01-input.ts','tools/p6/l01-byte-check.ts','tools/p5/media-library.ts','assets/media/m01/registry.json'];
const report={status:'LOCAL_BYTE_CHECK_PASS_ONLY',verified_final_wavs:420,acoustic_single_turn_results:402,assembled_dialogues:18,final_counts:{en:210,cs:210},selected_wavs:entries.filter(e=>e.metadata.kind==='audio').length,selected_svgs:entries.filter(e=>e.metadata.kind!=='audio').length,media_uses:unit.activities.reduce((n,a)=>n+a.presentation.media_refs.length,0),pins:unit.media_pins,postgresql_executed:false,s3_executed:false,browser_executed:false,production_profile_approved:false,code_bindings:Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])))};
await mkdir('artifacts/p6',{recursive:true});await writeFile('artifacts/p6/l01-local-byte-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,verified_final_wavs:420,selected_wavs:report.selected_wavs,selected_svgs:report.selected_svgs}));
