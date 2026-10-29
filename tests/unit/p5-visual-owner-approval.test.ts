import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadMediaLibrary} from '../../tools/p5/media-library.js';
import {verifyVisualOwnerApproval} from '../../tools/p5/visual-owner-approval.js';

test('Owner decision binds all 30 exact visual versions without creating runtime permissions',async()=>{
 const library=await loadMediaLibrary(process.cwd(),{metadataOnly:true});
 const result=await verifyVisualOwnerApproval(process.cwd(),library);
 assert.equal(result.assets_verified,30);assert.equal(result.runtime_approval_insertion,false);
 assert.equal(result.production_publication_authorized,false);assert.equal(result.od_004_closed,false);assert.equal(result.od_006_closed,false);
});
test('Owner visual acceptance cannot transfer to changed bytes, metadata, language, versions or missing assets',async()=>{
 for(const change of ['bytes','metadata','language','version','missing'] as const){
  const library=await loadMediaLibrary(process.cwd(),{metadataOnly:true}),entry=library.entries.find(e=>e.metadata.kind!=='audio')!;
  if(change==='bytes')entry.bytes=Buffer.from('changed');
  if(change==='metadata')entry.metadata.alt_text='Changed description';
  if(change==='language')entry.metadata.scope.language=entry.metadata.scope.language==='en'?'cs':'en';
  if(change==='version')entry.metadata.asset_version++;
  if(change==='missing')library.entries.splice(library.entries.indexOf(entry),1);
  await assert.rejects(verifyVisualOwnerApproval(process.cwd(),library),change);
 }
});
