import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadMediaLibrary} from './media-library.js';
import {LocalAssetStore} from '../../packages/provider-adapters/storage/local.js';
import {assetObjectKey} from '../../packages/provider-adapters/storage/asset-integrity.js';

const root=process.env.P5_M01_AUDIO_ROOT;
if(!root||!isAbsolute(root))throw new Error('Explicit absolute external P5_M01_AUDIO_ROOT required');
const library=await loadMediaLibrary(process.cwd(),{externalAudioRoot:root});
const pilot=JSON.parse(await readFile('docs/p5/acoustic-provider/pilot-plan.json','utf8')) as {rows:Array<{asset_id:string;sha256:string}>};
const selected=new Map(pilot.rows.map(r=>[r.asset_id,r.sha256]));assert.equal(selected.size,402);
const audio=library.entries.filter(e=>e.metadata.kind==='audio'),dialogues=audio.filter(e=>e.metadata.turns!.length>1);
assert.equal(audio.length,420);assert.equal(dialogues.length,18);
for(const e of audio)if(e.metadata.turns!.length===1)assert.equal(selected.get(e.metadata.asset_id),e.metadata.checksum);else assert(!selected.has(e.metadata.asset_id));
const directory=await mkdtemp(join(tmpdir(),'p5-verified-m01-'));
try{
 const store=new LocalAssetStore(directory);
 for(const {metadata:m,bytes} of library.entries)await store.putImmutable(assetObjectKey(m.asset_id,m.asset_version,m.checksum),bytes,m.mime,m.checksum);
 const recovered=new LocalAssetStore(directory);
 for(const {metadata:m,bytes} of library.entries){const key=assetObjectKey(m.asset_id,m.asset_version,m.checksum);assert.deepEqual(await recovered.readVerified(key,m.checksum,m.byte_length),bytes);await recovered.putImmutable(key,bytes,m.mime,m.checksum);}
 const first=audio[0]!,m=first.metadata,key=assetObjectKey(m.asset_id,m.asset_version,m.checksum),changed=Buffer.from(first.bytes);changed[changed.length-1]=changed[changed.length-1]!^1;
 await assert.rejects(recovered.putImmutable(key,changed,m.mime,m.checksum),{code:'INVALID_INPUT'});
 assert.deepEqual(await recovered.readVerified(key,m.checksum,m.byte_length),first.bytes);
 const paths=['tools/p5/verify-external-m01.ts','tools/p5/media-library.ts','assets/media/m01/registry.json','assets/media/m01/source-all-assets.json','docs/p5/m01-completion-20261014/owner-approval.json','docs/p5/acoustic-provider/pilot-plan.json','docs/p5/acoustic-provider/pilot-results/summary.json'];
 const report={status:'PASS',scope:'EXTERNAL_M01_BYTES_AND_LOCAL_ADAPTER_ONLY',approved_dataset_sha256:library.registry.approved_dataset_sha256,files:420,audio_bytes:audio.reduce((n,e)=>n+e.bytes.length,0),languages:Object.fromEntries(['en','cs'].map(l=>[l,{final_files:audio.filter(e=>e.metadata.scope.language===l).length,pilot_single_turns:audio.filter(e=>e.metadata.scope.language===l&&e.metadata.turns!.length===1).length,dialogue_files:dialogues.filter(e=>e.metadata.scope.language===l).length}])),pilot_files:402,pilot_excludes_dialogue_files:18,controls_are_final_assets:false,visual_drafts:30,registry_versions_verified:450,pcm_and_frame_cues_verified:true,six_voice_bindings_verified:true,normal_slow_bindings_verified:true,local_adapter_recreated:true,all_stored_bytes_verified:true,exact_replay:true,changed_bytes_rejected:true,postgresql_executed:false,s3_executed:false,audio_regenerated:false,production_calibration_approved:false,p6_authorized:false,code_bindings:Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])))};
 await mkdir('artifacts/p5',{recursive:true});await writeFile('artifacts/p5/external-m01-byte-validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await rm(directory,{recursive:true,force:true});}
