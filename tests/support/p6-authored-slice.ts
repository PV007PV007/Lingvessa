import {readFileSync} from 'node:fs';
import {authoredUnitSchema,compileAuthoredUnit} from '../../packages/content-tools/src/authored-unit.js';
/** An explicit, version-isolated test subset; never silently remove media from a contract. */
export function l01TestSlice(raw:unknown){
  const unit=authoredUnitSchema.parse(raw);
  const spec=JSON.parse(readFileSync('tests/fixtures/p6/l01-test-slice.json','utf8')) as {activity_ids:string[];version_ids:Record<string,string>;version_code:string;scope:string};
  const selected=new Set(spec.activity_ids);
  unit.activities=unit.activities.filter(a=>selected.has(a.id));
  if(unit.activities.length!==selected.size)throw new Error('Test slice activity missing');
  const referenced=new Set(unit.activities.flatMap(a=>[...a.learning.knowledge_refs.map(k=>k.knowledge_item_id),...a.learning.outcome_refs.map(o=>o.outcome_id)]));
  unit.entities=unit.entities.filter(e=>['course','level','module','lesson'].includes(e.kind)||selected.has(e.id)||referenced.has(e.id));
  for(const e of unit.entities){const version=spec.version_ids[e.id];if(!version)throw new Error('Missing isolated test version');e.version_id=version;e.version_code=spec.version_code;}
  const lesson=unit.entities.find(e=>e.id===unit.lesson_id)!;
  for(const a of unit.activities)a.content_version_id=lesson.version_id;
  const assets=new Set(unit.activities.flatMap(a=>a.presentation.media_refs.map(r=>r.asset_id)));
  unit.media_pins=unit.media_pins.filter(p=>assets.has(p.asset_id));unit.scope=spec.scope;
  if(unit.media_pins.some(p=>p.kind==='audio'))throw new Error('SVG/text slice unexpectedly includes audio; provide the full approved input');
  return compileAuthoredUnit(unit).unit;
}
