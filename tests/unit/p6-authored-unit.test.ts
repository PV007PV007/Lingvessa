import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileAuthoredUnit,verifyAuthoredMedia} from '../../packages/content-tools/src/authored-unit.js';
import {evaluateActivity} from '../../packages/lesson-engine/src/evaluator.js';
import {loadMediaLibrary} from '../../tools/p5/media-library.js';
import {l01TestSlice} from '../support/p6-authored-slice.js';
const raw=()=>JSON.parse(readFileSync('content/english/m01/l01.json','utf8'));
test('authored L01 resolves shared contracts, source steps and exact immutable media',async()=>{
  const {unit,payloads}=compileAuthoredUnit(raw());
  assert.equal(unit.activities.length,29);assert.equal(payloads.length,44);assert.equal(unit.media_pins.length,35);
  assert.deepEqual([...new Set(unit.entities.filter(e=>e.kind==='activity').map(e=>e.metadata.source_step))],Array.from({length:11},(_,i)=>i+1));
  assert(!unit.activities.some(a=>a.type==='result'),'Step 12 is the native result/remediation flow');
  const library=await loadMediaLibrary(process.cwd(),{metadataOnly:true}),metadata=library.entries.map(e=>e.metadata);
  verifyAuthoredMedia(unit,metadata);
  const changed=structuredClone(metadata);changed.find(m=>m.asset_id===unit.media_pins[0]!.asset_id)!.checksum='0'.repeat(64);
  assert.throws(()=>verifyAuthoredMedia(unit,changed));
  assert.throws(()=>verifyAuthoredMedia(unit,[]));
  const noAvatar=structuredClone(unit);const dialogue=noAvatar.activities.find(a=>a.stable_code.endsWith('-ARRIVAL'))!;
  dialogue.presentation.media_refs=dialogue.presentation.media_refs.filter(r=>!r.asset_stable_code.startsWith('AV_'));
  assert.throws(()=>verifyAuthoredMedia(noAvatar,metadata));
});
test('authored source rejects lineage, role and pinned-version corruption',()=>{
  const unit=compileAuthoredUnit(raw()).unit;
  for(const mutate of [
    (u:typeof unit)=>{u.activities[0]!.content_version_id=u.entities[0]!.version_id;},
    (u:typeof unit)=>{u.activities[0]!.presentation.media_refs[0]!.asset_version++;},
    (u:typeof unit)=>{u.activities[0]!.presentation.media_refs.push(u.activities[0]!.presentation.media_refs[0]!);},
    (u:typeof unit)=>{u.entities.find(e=>e.kind==='activity')!.parent_id=u.entities[0]!.id;},
  ]){const changed=structuredClone(unit);mutate(changed);assert.throws(()=>compileAuthoredUnit(changed));}
});
test('retrieval accepts configured language variants without promoting typing to speech',()=>{
  const {unit}=compileAuthoredUnit(raw()),get=(suffix:string)=>unit.activities.find(a=>a.stable_code.endsWith(suffix))!;
  const repeat=get('RETRIEVE-REPEAT');
  for(const text of ['Can you repeat, please?','could you repeat that please','Can you repeat please'])assert.equal(evaluateActivity(repeat,{kind:'text',text}).result,'correct');
  assert.equal(evaluateActivity(repeat,{kind:'text',text:'Thank you'}).result,'incorrect');
  assert.equal(evaluateActivity(get('BUILD-HELLO'),{kind:'text',text:'HELLO'}).result,'correct');
  assert.equal(evaluateActivity(get('BUILD-HELLO'),{kind:'text',text:'helo'}).result,'incorrect');
  assert(!unit.activities.filter(a=>a.response.kind!=='speech').some(a=>a.learning.evidence_map.some(m=>['speaking','pronunciation'].includes(m.skill))));
  const repair=get('-REPAIR');assert(!repair.presentation.media_refs.some(r=>r.asset_stable_code==='AUD_ENG_M01_DIALOGUES_L01_REPAIR'));
});
test('hosted SVG/text test slice retains nine whole activities under separate version pins',()=>{
  const full=compileAuthoredUnit(raw()).unit,slice=l01TestSlice(full);
  assert.equal(slice.activities.length,9);assert.equal(slice.media_pins.length,5);
  for(const a of slice.activities){const original=full.activities.find(o=>o.id===a.id)!;assert.notEqual(a.content_version_id,original.content_version_id);assert.deepEqual({...a,content_version_id:original.content_version_id},original);}
  assert(slice.entities.every(e=>e.version_id!==full.entities.find(f=>f.id===e.id)!.version_id));
});
