import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import type {LoadedMediaLibrary} from './media-library.js';

interface CatalogAsset {asset_id:string;stable_code:string;kind:string;language:string;speed?:string;normal_asset_id?:string|null}
export interface M01Catalog {audio:CatalogAsset[];visuals:Array<{metadata:Omit<CatalogAsset,'language'>&{scope:{language:string}}}>}

/** Preparation only: exact catalog identities and dependencies, never editorial approval or publication. */
export function resolveM01Bindings(library:LoadedMediaLibrary,catalog:M01Catalog){
 const expected=[...catalog.audio,...catalog.visuals.map(({metadata:m})=>({...m,language:m.scope.language}))];
 assert.equal(expected.length,450);assert.equal(library.entries.length,450);
 assert.equal(new Set(expected.map(a=>a.asset_id)).size,450,'Duplicate catalog identity');
 assert.equal(new Set(library.entries.map(e=>e.metadata.asset_id)).size,450,'Duplicate library identity');
 const assets=new Map(library.entries.map(e=>[e.metadata.asset_id,e]));
 const voices=new Map(library.registry.voices.map(v=>[v.id,v]));
 const characters=new Map(library.registry.characters.map(c=>[c.id,c]));
 const bindings=expected.map(required=>{
  const entry=assets.get(required.asset_id);assert(entry,'Unresolved catalog identity');const a=entry.metadata;
  assert.equal(a.stable_code,required.stable_code,'Stable code mismatch');
  assert.equal(a.scope.language,required.language,'Catalog language mismatch');assert.equal(a.kind,required.kind);
  assert.equal(a.asset_version,2);assert.equal(a.version_code,a.kind==='audio'?'m01-approved-1':'m01-visual-draft-1');
  let normal_pin=null;
  if(a.kind==='audio'){
   assert.equal(a.speed,required.speed);
   if(a.speed==='slow'){
    assert.equal(a.normal_asset_id,required.normal_asset_id);const normal=assets.get(a.normal_asset_id!)?.metadata;
    assert(normal,'Missing normal asset');assert.equal(normal.asset_version,a.normal_asset_version);
    assert.equal(normal.scope.language,a.scope.language);assert.equal(normal.speed,'normal');
    assert.equal(normal.script_hash,a.script_hash);assert.equal(normal.transcript,a.transcript);
    normal_pin={asset_id:normal.asset_id,asset_version:normal.asset_version,checksum:normal.checksum};
   }
  }
  const speakers=[...new Map((a.turns??[]).map(t=>[t.voice_id+':'+(t.character_id??''),t])).values()].map(t=>{
   const voice=voices.get(t.voice_id);assert(voice,'Missing voice');assert.equal(voice.version_code,t.voice_version_code);assert.equal(voice.scope.language,a.scope.language);
   let avatar_pin=null;
   if(t.character_id){
    const character=characters.get(t.character_id);assert(character,'Missing character');
    assert.equal(character.version_code,t.character_version_code);assert.equal(character.voice_id,voice.id);
    assert.equal(character.voice_version_code,voice.version_code);assert.equal(character.scope.language,a.scope.language);
    const avatars=library.entries.filter(e=>e.metadata.kind==='avatar'&&e.metadata.character_id===character.id&&e.metadata.character_version_code===character.version_code);
    assert.equal(avatars.length,1,'Missing or ambiguous exact character-version avatar');const avatar=avatars[0]!.metadata;
    assert.equal(avatar.scope.language,a.scope.language,'Cross-language avatar');
    avatar_pin={asset_id:avatar.asset_id,asset_version:avatar.asset_version,checksum:avatar.checksum};
   }
   return {voice_id:voice.id,voice_version_code:voice.version_code,character_id:t.character_id??null,character_version_code:t.character_version_code??null,avatar_pin};
  });
  return {asset_id:a.asset_id,stable_code:a.stable_code,asset_version:a.asset_version,version_code:a.version_code,language:a.scope.language,kind:a.kind,checksum:a.checksum,byte_length:a.byte_length,source_file:entry.file,
   // This is a source-serialization hash; PostgreSQL's canonical metadata checksum is recorded by the real test separately.
   metadata_json_sha256:createHash('sha256').update(JSON.stringify(a)).digest('hex'),normal_pin,speakers,
   review_status:a.kind==='audio'?'OWNER_APPROVED_AUDIO_2026_10_14':'PENDING_VISUAL_REVIEW'};
 }).sort((a,b)=>a.asset_id.localeCompare(b.asset_id));
 for(const language of ['en','cs']){assert.equal(bindings.filter(b=>b.language===language&&b.kind==='audio').length,210);assert.equal(bindings.filter(b=>b.language===language&&b.kind!=='audio').length,15);}
 assert.equal(bindings.filter(b=>b.normal_pin).length,210);
 return bindings;
}
