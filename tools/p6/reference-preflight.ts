import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {z} from 'zod';
import {verifyReferenceProbes} from '../../packages/content-tools/src/reference-probes.js';
import {isSkillFacet} from '../../packages/activity-schemas/src/mastery.js';
import {loadMediaLibrary} from '../p5/media-library.js';
import {resolveM01Bindings} from '../p5/m01-publication-bindings.js';
import {verifyVisualOwnerApproval} from '../p5/visual-owner-approval.js';

const sequencePath='content/english/m01/sequence.json',probePath='content/english/m01/evaluation-probes.json';
const sourcePath='01_GOVERNING_DOCUMENTS/Lingvessa_Reference_Module_Design.pdf';
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const step=z.object({position:z.number().int().positive(),source_page:z.number().int().min(9).max(13),title:z.string().min(1),objective:z.string().min(1),
  candidate_media_codes:z.array(z.string()),target_facets:z.array(z.string()),runtime_status:z.literal('NOT_IMPLEMENTED')}).strict();
const outlineSchema=z.object({schema_version:z.literal('p6-authoring-outline-1'),module:z.literal('E-A1-M01'),language:z.literal('en'),
  default_variety:z.literal('en-GB'),selectable_varieties:z.tuple([z.literal('en-GB'),z.literal('en-US')]),
  source_document:z.literal('Lingvessa_Reference_Module_Design.pdf'),source_version:z.literal('1.6'),source_sha256:z.string(),
  scope:z.string(),publication_ready:z.literal(false),lessons:z.array(z.object({stable_code:z.string(),lesson_id:z.uuid(),title:z.string(),
    kind:z.enum(['lesson','recap']),source_section:z.string(),steps:z.array(step)}).strict()).length(5)}).strict();
const outline=outlineSchema.parse(JSON.parse(await readFile(sequencePath,'utf8')));
assert.equal(hash(await readFile(sourcePath)),outline.source_sha256);
assert.deepEqual(outline.lessons.map(l=>l.stable_code),['L01','L02','L03','L04','R01'].map(x=>'E-A1-M01-'+x));
assert.deepEqual(outline.lessons.map(l=>l.steps.length),[12,12,12,12,10]);
assert.equal(new Set(outline.lessons.map(l=>l.lesson_id)).size,5);
for(const lesson of outline.lessons){
  assert.deepEqual(lesson.steps.map(s=>s.position),lesson.steps.map((_,i)=>i+1));
  for(const row of lesson.steps)for(const pair of row.target_facets){const [skill,facet]=pair.split('/');assert(skill&&facet&&isSkillFacet(skill,facet),`Unknown canonical target ${pair}`);}
}
const probes=verifyReferenceProbes(JSON.parse(await readFile(probePath,'utf8')));
const library=await loadMediaLibrary(process.cwd(),{metadataOnly:true});
const visualApproval=await verifyVisualOwnerApproval(process.cwd(),library);
const bindings=resolveM01Bindings(library,JSON.parse(await readFile('assets/specs/p5/reference-media.registry.json','utf8'))).filter(a=>a.language==='en');
assert.equal(bindings.length,225);assert.equal(bindings.filter(a=>a.kind==='audio').length,210);
const byCode=new Map(bindings.map(a=>[a.stable_code,a]));
const selected=outline.lessons.flatMap(lesson=>lesson.steps.flatMap(row=>row.candidate_media_codes.map(code=>{
  const asset=byCode.get(code);assert(asset,`Unresolved English candidate media ${code}`);
  return {unit:lesson.stable_code,step:row.position,asset_id:asset.asset_id,stable_code:code,asset_version:asset.asset_version,checksum:asset.checksum};
})));
const sourceSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(process.env.GITHUB_HEAD_SHA)assert.equal(sourceSha,process.env.GITHUB_HEAD_SHA);
const codePaths=[sequencePath,probePath,sourcePath,'packages/content-tools/src/reference-probes.ts','packages/lesson-engine/src/evaluator.ts',
  'packages/activity-schemas/src/lesson.ts','tools/p6/reference-preflight.ts','tests/unit/p6-reference.test.ts',
  'docs/p6/authorization.json','docs/p6/defects.json','assets/media/m01/registry.json','tools/p5/media-library.ts','tools/p5/m01-publication-bindings.ts'];
const report={schema_version:1,phase:'P6',source_sha:sourceSha,status:'PREFLIGHT_PASS_NOT_MILESTONE',
  scope:'Authoring outline, unchanged shared-evaluator probes, approved English metadata pins and actual SVG bytes only',
  units:5,source_steps:58,probes,english_catalog_assets:225,english_audio_metadata:210,english_visual_bytes:15,
  english_voices:library.registry.voices.filter(v=>v.scope.language==='en').map(v=>({id:v.id,variety:v.scope.variety})),
  selected_media_candidates:selected,visual_owner_approval:visualApproval,
  audio_bytes_verified:false,audio_metadata_pins:bindings.filter(a=>a.kind==='audio'),
  lesson_runtime_executed:false,postgresql_m01_lessons_executed:false,browser_m01_lessons_executed:false,
  production_profile_approved:false,milestone_status:'NOT_READY',p6_authorized:true,p7_authorized:false,
  open_defects:JSON.parse(await readFile('docs/p6/defects.json','utf8')),
  code_bindings:Object.fromEntries(await Promise.all(codePaths.map(async path=>[path,hash(await readFile(path))])))};
await mkdir('artifacts/p6',{recursive:true});await writeFile('artifacts/p6/reference-preflight.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,source_sha:sourceSha,units:5,steps:58,probes:probes.probes,cases:probes.cases.length,english_catalog_assets:225,milestone_status:'NOT_READY'}));
