import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadMediaLibrary} from '../../tools/p5/media-library.js';
import {resolveM01Bindings} from '../../tools/p5/m01-publication-bindings.js';
const catalog=JSON.parse(await readFile('assets/specs/p5/reference-media.registry.json','utf8'));
test('M01 catalog resolves all immutable versions without upgrading visual approval',async()=>{
 const library=await loadMediaLibrary(process.cwd(),{metadataOnly:true}),bindings=resolveM01Bindings(library,catalog);
 assert.equal(bindings.length,450);assert.equal(bindings.filter(b=>b.normal_pin).length,210);
 assert.equal(bindings.filter(b=>b.review_status==='PENDING_VISUAL_REVIEW').length,30);
 assert.equal(new Set(bindings.flatMap(b=>b.speakers.map(s=>s.voice_id))).size,6);
 assert.equal(new Set(bindings.flatMap(b=>b.speakers.flatMap(s=>s.avatar_pin?[s.avatar_pin.asset_id]:[]))).size,6);
});
test('M01 preparation rejects missing, cross-language and stale-version bindings',async()=>{
 for(const change of ['missing','language','avatar-version','normal-version'] as const){
  const library=await loadMediaLibrary(process.cwd(),{metadataOnly:true});
  if(change==='missing')library.entries.pop();
  if(change==='language')library.entries[0]!.metadata.scope.language='cs';
  if(change==='avatar-version')library.entries.find(e=>e.metadata.kind==='avatar')!.metadata.character_version_code='stale';
  if(change==='normal-version')library.entries.find(e=>e.metadata.speed==='slow')!.metadata.normal_asset_version=1;
  assert.throws(()=>resolveM01Bindings(library,catalog),change);
 }
});
