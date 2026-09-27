import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import type pg from 'pg';
import {IdentityRepository} from '../../infra/persistence/identity.js';
import {ContentRepository} from '../../infra/persistence/content.js';
import {MediaRepository} from '../../infra/persistence/media.js';
import {loadReferenceFixture} from '../../infra/persistence/fixtures.js';
import {referenceFixtureSchema} from '../../packages/content-tools/src/fixture.js';
import type {AssetVersion} from '../../packages/activity-schemas/src/media.js';
import type {ContentPayload} from '../../packages/activity-schemas/src/content.js';
import type {AssetStore} from '../../packages/application/src/media.js';
import {mediaApprovalGates} from '../../packages/application/src/media.js';

export function svgAsset(language:'en'|'cs',assetId:string=randomUUID(),version=1){
 const bytes=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><title>Two circles</title><circle cx="24" cy="40" r="16" fill="#345"/><circle cx="56" cy="40" r="16" fill="#abc"/></svg>');
 const checksum=createHash('sha256').update(bytes).digest('hex');
 const metadata:AssetVersion={asset_id:assetId,stable_code:`P5_${language}_VECTOR`,asset_version:version,version_code:`fixture-${version}`,kind:'vector',scope:{language,variety:language==='en'?'common':'cs-CZ'},purpose:'Synthetic storage/publication contract fixture, not reference-module media',
  mime:'image/svg+xml',checksum,byte_length:bytes.length,width:80,height:80,decorative:false,alt_text:language==='en'?'Two circles':'Dva kruhy',
  rights:{licence:'Repository synthetic test fixture only',provenance:'Original programmatic geometric test fixture; no external input, person or provider',source_kind:'programmatic',generator_version:'p5-fixture-1',spec_hash:checksum,real_person_clone:false}};
 return {metadata,bytes};
}
export async function p5MediaFixture(db:pg.Pool,store:AssetStore){
 const identity=new IdentityRepository(db),content=new ContentRepository(db,store),media=new MediaRepository(db,store);
 const author=await identity.provision('p5-author@example.invalid','Synthetic P5 author password!'),reviewer=await identity.provision('p5-reviewer@example.invalid','Synthetic P5 reviewer password!'),learner=await identity.provision('p5-learner@example.invalid','Synthetic P5 learner password!');
 await db.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE stable_code='content_editor'",[author]);
 await db.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE stable_code IN ('linguistic_reviewer','pedagogical_reviewer','administrator')",[reviewer]);
 const sources=Object.fromEntries(['en','cs'].map(l=>[l,referenceFixtureSchema.parse(JSON.parse(readFileSync(`content/fixtures/p2/${l}-m01.json`,'utf8')))])) as Record<'en'|'cs',ReturnType<typeof referenceFixtureSchema.parse>>;
 for(const source of Object.values(sources))await loadReferenceFixture(db,author,source);
 const assetMap=new Map<string,{asset_id:string;asset_version:number;checksum:string;metadata_checksum:string}>();
 const load=async(language:'en'|'cs',version=1)=>{
  const source=sources[language],lesson=source.entities.find(e=>e.kind==='lesson')!,payload=(await db.query('SELECT payload FROM content_versions WHERE id=$1',[lesson.version_id])).rows[0]!.payload as ContentPayload;
  const activity=payload.activities![0]!, requirement=randomUUID();
  await media.declareRequirement(author,{id:requirement,target_content_version_id:lesson.version_id,item_id:activity.id,role:`visual_${version}`,required:true,kind:'vector',scope:{language,variety:language==='en'?'common':'cs-CZ'},specification_version:'test-1',specification:'Two original circles; controlled fixture',accessibility_role:'semantic'});
  const key=randomUUID(),job=await media.enqueue(author,requirement,key,'programmatic_fixture','p5-fixture-1');
  const asset=svgAsset(language,assetMap.get(language)?.asset_id,version),ingested=await media.ingest(author,job,asset.metadata,asset.bytes);
  assetMap.set(language,ingested);
  return {source,lesson,payload,activity,requirement,key,job,asset,ingested};
 };
 const approve=async(asset:{asset_id:string;asset_version:number;checksum:string;metadata_checksum:string})=>{
  for(const gate of mediaApprovalGates)await media.approve(reviewer,asset.asset_id,asset.asset_version,asset.checksum,asset.metadata_checksum,gate,'approved','Synthetic fixture gate only; not production language/media QA');
 };
 const bind=async(loaded:Awaited<ReturnType<typeof load>>)=>{
  const p=loaded.payload,ref={asset_id:loaded.asset.metadata.asset_id,asset_stable_code:loaded.asset.metadata.stable_code,asset_version:loaded.asset.metadata.asset_version,role:`visual_${loaded.asset.metadata.asset_version}`};
  p.activities![0]!.media_refs.push(ref);
  const rev=(await db.query('SELECT revision FROM content_versions WHERE id=$1',[p.content_version_id])).rows[0]!.revision as number;
  await content.saveDraft(author,loaded.source.language_id,p,rev);
 };
 const publish=async(language:'en'|'cs',code:string)=>{
  const source=sources[language];for(const e of source.entities){await content.validateVersion(e.version_id);const v=(await db.query('SELECT checksum,revision FROM content_versions WHERE id=$1',[e.version_id])).rows[0]!;
   for(const gate of ['linguistic','pedagogical','technical','accessibility','media','originality'])if(!(await db.query('SELECT 1 FROM approvals WHERE target_content_version_id=$1 AND target_revision=$2 AND gate_type=$3',[e.version_id,v.revision,gate])).rowCount)await content.approve(reviewer,e.version_id,v.checksum,v.revision,gate,'approved','Synthetic P5 media contract approval');
  }
  return content.publish({id:randomUUID(),actorId:reviewer,courseId:source.entities.find(e=>e.kind==='course')!.id,languageId:source.language_id,channel:'test',versionCode:code,versionIds:source.entities.map(e=>e.version_id)});
 };
 return {identity,content,media,author,reviewer,learner,sources,load,approve,bind,publish};
}
