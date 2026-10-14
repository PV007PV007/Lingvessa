import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {existsSync} from 'node:fs';
import {loadMediaLibrary} from '../../tools/p5/media-library.js';
import {LocalAssetStore} from '../../packages/provider-adapters/storage/local.js';
import {assetObjectKey} from '../../packages/provider-adapters/storage/asset-integrity.js';
import {mediaRequirementSchema} from '../../packages/activity-schemas/src/media.js';
import {mediaStore} from '../../infra/config/media.js';
test('P5 complete media metadata preserves 450 schema-valid identities without importing unverified bytes',async()=>{
 const library=await loadMediaLibrary(process.cwd(),{metadataOnly:true});assert.equal(library.entries.length,450);assert.equal(library.audio_bytes_verified,false);
 assert.equal(library.entries.filter(e=>e.metadata.kind==='audio').length,420);assert.equal(library.registry.automatic_approval_insertion,false);
});
test('P5 real M01: 450 immutable files survive storage restart and exact replay',{timeout:60000,skip:!process.env.P5_M01_AUDIO_ROOT&&!existsSync('assets/media/m01/en/AUD_ENG_M01_WORDS_HELLO.wav')},async()=>{
 const externalAudioRoot=process.env.P5_M01_AUDIO_ROOT,library=await loadMediaLibrary(process.cwd(),externalAudioRoot?{externalAudioRoot}:{}),root=await mkdtemp(join(tmpdir(),'p5-approved-bytes-'));
 try{assert.equal(library.entries.length,450);assert.equal(library.entries.filter(e=>e.metadata.kind==='audio').length,420);const store=new LocalAssetStore(root);
  for(const e of library.entries){const a=e.metadata;await store.putImmutable(assetObjectKey(a.asset_id,a.asset_version,a.checksum),e.bytes,a.mime,a.checksum);}
  const restarted=new LocalAssetStore(root);for(const e of library.entries){const a=e.metadata,key=assetObjectKey(a.asset_id,a.asset_version,a.checksum);assert.deepEqual(await restarted.readVerified(key,a.checksum,a.byte_length),e.bytes);await restarted.putImmutable(key,e.bytes,a.mime,a.checksum);}
  assert.equal(library.registry.automatic_approval_insertion,false);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('P5 library target and private-local scope are explicit and exclusive',()=>{
 const base={id:randomUUID(),role:'audio',required:true,kind:'audio',scope:{language:'en',variety:'en-GB'},specification_version:'1',specification:'Exact bytes',accessibility_role:'semantic'};
 assert(mediaRequirementSchema.safeParse({...base,library_batch_id:randomUUID()}).success);assert(!mediaRequirementSchema.safeParse(base).success);
 assert(!mediaRequirementSchema.safeParse({...base,library_batch_id:randomUUID(),target_content_version_id:randomUUID(),item_id:randomUUID()}).success);
 assert.throws(()=>mediaStore({LINGVESSA_ENV:'production',MEDIA_STORAGE_MODE:'private_local',MEDIA_LOCAL_ROOT:'/tmp/p5'}));assert.throws(()=>mediaStore({LINGVESSA_ENV:'local',MEDIA_STORAGE_MODE:'private_local'}));
});
