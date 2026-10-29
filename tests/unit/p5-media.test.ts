import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {LocalAssetStore} from '../../packages/provider-adapters/storage/local.js';
import {S3AssetStore,signedS3Headers} from '../../packages/provider-adapters/storage/s3.js';
import {assetObjectKey,bytesHash,validateAssetBytes} from '../../packages/provider-adapters/storage/asset-integrity.js';
import {assetVersionSchema,voiceSchema} from '../../packages/activity-schemas/src/media.js';
import {svgAsset} from '../support/p5-fixtures.js';

test('P5 immutable store: concurrent replay, corruption, checksum, traversal and active SVG rejection',async()=>{
 const root=await mkdtemp(join(tmpdir(),'lingvessa-media-'));
 try{const store=new LocalAssetStore(root),{metadata:a,bytes}=svgAsset('en'),key=assetObjectKey(a.asset_id,1,a.checksum);
  const results=await Promise.all([store.putImmutable(key,bytes,a.mime,a.checksum),store.putImmutable(key,bytes,a.mime,a.checksum)]);assert.deepEqual(results[0],results[1]);
  assert.deepEqual(Buffer.from(await store.readVerified(key,a.checksum,a.byte_length)),bytes);
  await assert.rejects(store.readVerified('../outside',a.checksum,100));
  await assert.rejects(store.putImmutable(key,Buffer.from('changed'),a.mime,a.checksum));
  for(const xml of ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>','<svg onload="alert(1)"></svg>','<svg ><image href="https://example.invalid"/></svg>','<svg ><foreignObject/></svg>']){
   const body=Buffer.from(xml);assert.throws(()=>validateAssetBytes(body,'image/svg+xml',bytesHash(body)));
  }
  await writeFile(join(root,key.replaceAll('/','_')),Buffer.from(JSON.stringify(results[0])+'\ncorrupt'));
  await assert.rejects(store.readVerified(key,a.checksum,a.byte_length),/integrity/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('P5 schema rejects absent alt, mismatched scope, voice clone and invalid audio turn timing',()=>{
 const {metadata:a}=svgAsset('cs');assert(assetVersionSchema.safeParse(a).success);
 assert(!assetVersionSchema.safeParse({...a,alt_text:''}).success);
 assert(!assetVersionSchema.safeParse({...a,scope:{language:'cs',variety:'en-GB'}}).success);
 assert(!assetVersionSchema.safeParse({...a,kind:'avatar'}).success);
 const avatar={...a,kind:'avatar',character_id:randomUUID(),character_version_code:'fixture-1'};
 assert(assetVersionSchema.safeParse(avatar).success);
 assert(!assetVersionSchema.safeParse({...avatar,character_version_code:undefined}).success);
 assert(!assetVersionSchema.safeParse({...avatar,kind:'vector'}).success);
 const audio={...a,kind:'audio',mime:'audio/wav',scope:{language:'en',variety:'en-US'},duration_ms:2000,codec:'pcm_s16le',loudness_lufs:-20,transcript:'Hello',script_version:'1',script_hash:a.checksum,speed:'normal',voice_id:randomUUID(),voice_version_code:'1'};
 assert(assetVersionSchema.safeParse(audio).success);
 const turn={turn_id:randomUUID(),speaker:'one',voice_id:audio.voice_id,voice_version_code:'1',start_ms:0,end_ms:1000,text:'Hello'};
 assert(assetVersionSchema.safeParse({...audio,turns:[turn]}).success);
 assert(!assetVersionSchema.safeParse({...audio,turns:[{...turn,end_ms:2200}]}).success);
 assert(!assetVersionSchema.safeParse({...audio,turns:[{...turn,turn_id:undefined}]}).success);
 assert(!assetVersionSchema.safeParse({...audio,turns:[turn,{...turn,start_ms:1000,end_ms:1500}]}).success);
 assert(!voiceSchema.safeParse({id:randomUUID(),stable_code:'en_voice',version_code:'1',scope:{language:'en',variety:'en-GB'},profile:'Fictional',provider_adapter_code:'controlled_fixture',provider_external_id:'fixture',rights:{...a.rights,real_person_clone:true}}).success);
});
test('P5 S3 private configuration, deterministic signed payload and credential separation',()=>{
 const c={endpoint:'https://s3.example.invalid',region:'auto',bucket:'lingvessa-media',accessKey:'test-access',secretKey:'synthetic-test-only'};
 assert.doesNotThrow(()=>new S3AssetStore(c));
 for(const endpoint of ['http://s3.example.invalid','https://x:y@s3.example.invalid','https://s3.example.invalid/path'])assert.throws(()=>new S3AssetStore({...c,endpoint}));
 const url=new URL(c.endpoint+'/lingvessa-media/test'),at=new Date('2026-09-26T00:00:00Z');
 const first=signedS3Headers(c,'PUT',url,Buffer.from('hello'),{'if-none-match':'*'},at);
 assert.match(first.authorization!,/Credential=test-access\/20260926\/auto\/s3\/aws4_request/);assert(!JSON.stringify(first).includes(c.secretKey));
 assert.notEqual(first.authorization,signedS3Headers(c,'PUT',url,Buffer.from('changed'),{'if-none-match':'*'},at).authorization);
 assert.match(first.authorization!,/SignedHeaders=host;if-none-match;x-amz-content-sha256;x-amz-date/);
});
