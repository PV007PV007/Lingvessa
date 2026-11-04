import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {z} from 'zod';
import {referenceFixtureSchema} from './fixture.js';
import {activityContractSchema} from '../../activity-schemas/src/lesson.js';
import {assetVersionSchema} from '../../activity-schemas/src/media.js';
import type {AssetVersion} from '../../activity-schemas/src/media.js';
import {validateContent} from '../../activity-schemas/src/content.js';
import type {ContentPayload} from '../../activity-schemas/src/content.js';
import {resolveActivity} from '../../lesson-engine/src/registry.js';
import {ContractError} from '../../domain/src/identity.js';

const asset=assetVersionSchema.shape;
export const mediaPinSchema=z.object({asset_id:asset.asset_id,stable_code:asset.stable_code,asset_version:asset.asset_version,checksum:asset.checksum,byte_length:asset.byte_length,kind:asset.kind,scope:asset.scope,decorative:asset.decorative});
export const authoredUnitSchema=z.object({
  schema_version:z.literal('authored-unit-1'),source_document:z.string().min(1),source_sha256:z.string().regex(/^[a-f0-9]{64}$/u),
  language:z.enum(['en','cs']),language_id:z.uuid(),lesson_id:z.uuid(),scope:z.string().min(1),
  entities:referenceFixtureSchema.shape.entities,activities:z.array(activityContractSchema).min(1),media_pins:z.array(mediaPinSchema),
}).strict();
export type AuthoredUnit=z.infer<typeof authoredUnitSchema>;
const invalid=(message:string):never=>{throw new ContractError('INVALID_INPUT',message);};
export function responseModality(kind:AuthoredUnit['activities'][number]['response']['kind']){
  return kind==='none'?'none':kind==='speech'?'speech':kind==='text'?'typed':'selection';
}
/** Compile an authored closure. This creates neither approvals nor a publication. */
export function compileAuthoredUnit(raw:unknown){
  const unit=authoredUnitSchema.parse(raw),entities=new Map(unit.entities.map(e=>[e.id,e]));
  const lesson=entities.get(unit.lesson_id);if(lesson?.kind!=='lesson')invalid('Lesson identity missing');
  if(unit.entities.filter(e=>e.kind==='lesson').length!==1||unit.entities.filter(e=>e.kind==='course').length!==1||unit.entities.filter(e=>e.kind==='level').length!==1||unit.entities.filter(e=>e.kind==='module').length!==1)invalid('Exactly one course/level/module/lesson closure required');
  const maps=unit.activities.flatMap(a=>a.learning.knowledge_refs.flatMap(k=>a.learning.evidence_map.map(m=>({item_id:a.id,knowledge_item_id:k.knowledge_item_id,role:k.role,...m}))));
  referenceFixtureSchema.parse({fixture_version:'p2-reference-metadata-1',source_document:unit.source_document,scope:unit.scope,language:unit.language,language_id:unit.language_id,entities:unit.entities,evidence_maps:maps,knowledge_edges:[]});
  if(unit.activities.length!==unit.entities.filter(e=>e.kind==='activity').length||new Set(unit.activities.map(a=>a.id)).size!==unit.activities.length)invalid('Exactly one executable contract per activity required');
  const pins=new Map(unit.media_pins.map(p=>[p.asset_id,p]));if(pins.size!==unit.media_pins.length)invalid('Duplicate media pin');
  const used=new Set<string>();
  for(const a of unit.activities){
    const e=entities.get(a.id);
    if(!e||e.kind!=='activity'||e.parent_id!==lesson!.id||e.stable_code!==a.stable_code||e.metadata.activity_type!==a.type||e.metadata.response_modality!==responseModality(a.response.kind)||a.content_version_id!==lesson!.version_id||a.language!==unit.language)invalid('Activity lineage or contract identity mismatch');
    if(resolveActivity(a).status!=='supported')invalid('Unsupported shared activity contract');
    for(const k of a.learning.knowledge_refs)if(entities.get(k.knowledge_item_id)?.kind!=='knowledge'||entities.get(k.knowledge_item_id)?.stable_code!==k.stable_code)invalid('Knowledge reference mismatch');
    for(const o of a.learning.outcome_refs)if(entities.get(o.outcome_id)?.kind!=='outcome'||entities.get(o.outcome_id)?.stable_code!==o.stable_code)invalid('Outcome reference mismatch');
    if(new Set(a.presentation.media_refs.map(r=>r.role)).size!==a.presentation.media_refs.length)invalid('Activity-local media roles must be unique');
    for(const r of a.presentation.media_refs){const p=pins.get(r.asset_id);if(!p||p.stable_code!==r.asset_stable_code||p.asset_version!==r.asset_version||p.scope.language!==unit.language)invalid('Unpinned or foreign media');used.add(r.asset_id);}
  }
  if(used.size!==pins.size)invalid('Unused media pins in authored closure');
  const sourceHash=createHash('sha256').update(JSON.stringify(unit)).digest('hex');
  const ref=(id:string,relation:ContentPayload['refs'][number]['relation'])=>{const e=entities.get(id)!;return {relation,entity_id:id,content_version_id:e.version_id,stable_code:e.stable_code,version_code:e.version_code};};
  const payloads=unit.entities.map(e=>{
    const a=unit.activities.find(a=>a.id===e.id);
    const refs:ContentPayload['refs']=unit.entities.filter(c=>c.parent_id===e.id).map(c=>ref(c.id,'contains'));
    if(a){for(const k of a.learning.knowledge_refs)refs.push(ref(k.knowledge_item_id,'knowledge'));for(const o of a.learning.outcome_refs)refs.push(ref(o.outcome_id,'outcome'));}
    const payload:ContentPayload={schema_version:'1.7',entity_id:e.id,content_version_id:e.version_id,stable_code:e.stable_code,version_code:e.version_code,language:unit.language,kind:e.kind,title:e.title,variety_scope:e.variety_scope,refs,body:{...e.metadata,authored_source_hash:sourceHash,source_document:unit.source_document,source_sha256:unit.source_sha256,scope:unit.scope}};
    if(e.kind==='lesson')payload.activities=unit.activities.map(a=>({id:a.id,stable_code:a.stable_code,type:a.type,response_modality:responseModality(a.response.kind),completion_policy:a.runtime.completion_policy,knowledge_refs:a.learning.knowledge_refs,evidence_map:a.learning.evidence_map,media_refs:a.presentation.media_refs,contract:a}));
    return validateContent(payload);
  });
  return {unit,lesson:lesson!,payloads,maps,sourceHash};
}

/** Metadata must already exist under the exact immutable pin; audio needs its paired speed and speakers. */
export function verifyAuthoredMedia(unit:AuthoredUnit,metadata:AssetVersion[]){
  const byPin=new Map(metadata.map(m=>[`${m.asset_id}/${m.asset_version}`,m]));
  for(const p of unit.media_pins){const m=byPin.get(`${p.asset_id}/${p.asset_version}`);if(!m||!isDeepStrictEqual(mediaPinSchema.parse(m),p))invalid('Immutable media pin differs from imported metadata');}
  for(const a of unit.activities){
    const media=a.presentation.media_refs.map(r=>byPin.get(`${r.asset_id}/${r.asset_version}`)!);
    for(const m of media.filter(m=>m.kind==='audio')){
      if(m.scope.variety!==a.variety)invalid('Audio variety mismatch');
      const normal=m.speed==='normal'?m:media.find(n=>n.asset_id===m.normal_asset_id&&n.asset_version===m.normal_asset_version);
      const slow=media.find(s=>s.speed==='slow'&&s.normal_asset_id===normal?.asset_id&&s.normal_asset_version===normal?.asset_version);
      if(!normal||!slow||normal.transcript!==slow.transcript||normal.script_hash!==slow.script_hash)invalid('Activity lacks immutable normal/slow pair');
      for(const t of m.turns??[])if(t.character_id&&!media.some(v=>v.kind==='avatar'&&v.character_id===t.character_id&&v.character_version_code===t.character_version_code))invalid('Activity lacks versioned speaker avatar');
    }
  }
}
