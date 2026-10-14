import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {z} from 'zod';
import {assetVersionSchema,voiceSchema,characterSchema,mediaLibraryBatchSchema} from '../../packages/activity-schemas/src/media.js';
import type {AssetVersion} from '../../packages/activity-schemas/src/media.js';
import {validateAssetBytes} from '../../packages/provider-adapters/storage/asset-integrity.js';
import type {MediaRepository} from '../../infra/persistence/media.js';
const digest=z.string().regex(/^[a-f0-9]{64}$/u),hash=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const recordSchema=z.object({path:z.string(),sha256:digest,count:z.number().int().positive()}).strict();
const registrySchema=z.object({schema_version:z.literal(1),version_code:z.literal('m01-approved-1'),approved_dataset_sha256:digest,voices:z.array(voiceSchema).length(6),characters:z.array(characterSchema).length(6),batches:z.array(z.object({batch:mediaLibraryBatchSchema,authorization_path:z.string(),records:z.array(recordSchema),approval_status:z.enum(['OWNER_APPROVED_AUDIO','PENDING_VISUAL_REVIEW'])}).strict()).length(2),timing_conversion:z.string(),automatic_approval_insertion:z.literal(false),production_profile_approved:z.literal(false),p6_authorized:z.literal(false)}).strict();
const framesSchema=z.object({sample_rate:z.literal(24000),frames:z.number().int().positive(),cues:z.array(z.object({turn_id:z.string(),start_frame:z.number().int().nonnegative(),end_frame:z.number().int().positive()}).strict())}).strict();
const entrySchema=z.object({file:z.string(),metadata:assetVersionSchema,source_frames:framesSchema.optional(),human_review:z.literal('PENDING').optional()}).strict();
function contained(root:string,path:string){const target=resolve(root,path),rel=relative(root,target);if(isAbsolute(path)||rel==='..'||rel.startsWith('../')||isAbsolute(rel))throw new Error('Media path escapes repository');return target;}
function pcm(bytes:Buffer,a:AssetVersion,source:z.infer<typeof framesSchema>){
 if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE'||bytes.readUInt32LE(4)+8!==bytes.length)throw new Error('Invalid approved WAV envelope');
 let format=false,data:number|undefined;
 for(let offset=12;offset+8<=bytes.length;){
  const kind=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4),start=offset+8;if(start+size>bytes.length)throw new Error('Truncated WAV');
  if(kind==='fmt '){if(format||size<16||bytes.readUInt16LE(start)!==1||bytes.readUInt16LE(start+2)!==1||bytes.readUInt32LE(start+4)!==24000||bytes.readUInt16LE(start+14)!==16)throw new Error('WAV format mismatch');format=true;}
  if(kind==='data'){if(data!==undefined)throw new Error('Duplicate WAV data');data=size;}offset=start+size+(size%2);
 }
 if(!format||data!==source.frames*2||a.duration_ms!==Math.ceil(source.frames/24)||source.cues.length!==a.turns?.length)throw new Error('WAV duration/cues mismatch');
 source.cues.forEach((t,i)=>{const cue=a.turns![i]!;if(cue.turn_id!==t.turn_id||cue.start_ms!==Math.floor(t.start_frame/24+0.5)||cue.end_ms!==Math.floor(t.end_frame/24+0.5))throw new Error('Frame cue conversion mismatch');});
}
/** Validate every immutable byte and binding before any DB mutation. */
export async function loadMediaLibrary(root=process.cwd(),options:{metadataOnly?:boolean;externalAudioRoot?:string}={}){
 root=resolve(root);const registry=registrySchema.parse(JSON.parse(await readFile(contained(root,'assets/media/m01/registry.json'),'utf8')));
 const entries:Array<z.infer<typeof entrySchema>&{bytes:Buffer;batch_id:string}>=[],ids=new Set<string>(),voices=new Map(registry.voices.map(v=>[v.id,v])),characters=new Map(registry.characters.map(c=>[c.id,c]));
 for(const group of registry.batches){
  if(hash(await readFile(contained(root,group.authorization_path)))!==group.batch.authorization_checksum||hash(JSON.stringify(group.records,null,2)+'\n')!==group.batch.manifest_checksum)throw new Error('Batch authorization or manifest mismatch');let count=0;
  for(const record of group.records){
   const content=await readFile(contained(root,record.path));if(hash(content)!==record.sha256)throw new Error('Record checksum mismatch');
   const rows=z.array(entrySchema).parse(JSON.parse(content.toString('utf8')));if(rows.length!==record.count)throw new Error('Record count mismatch');count+=rows.length;
   for(const entry of rows){const a=entry.metadata;if(ids.has(a.asset_id))throw new Error('Duplicate asset');ids.add(a.asset_id);
    if((a.kind==='audio')!==(group.approval_status==='OWNER_APPROVED_AUDIO'))throw new Error('Approval scope crossed media kinds');
    const audioSkipped=a.kind==='audio'&&options.metadataOnly===true;
    if(options.externalAudioRoot&&!isAbsolute(options.externalAudioRoot))throw new Error('External audio root must be absolute');
    const source=a.kind==='audio'&&options.externalAudioRoot?resolve(options.externalAudioRoot,a.scope.language,a.stable_code+'.wav'):contained(root,entry.file);
    const bytes=audioSkipped?Buffer.alloc(0):await readFile(source);
    if(!audioSkipped){if(bytes.length!==a.byte_length)throw new Error('Byte length mismatch');validateAssetBytes(bytes,a.mime,a.checksum);}
    if(a.kind==='audio'){
     if(!entry.source_frames)throw new Error('Source frame cues missing');if(!audioSkipped)pcm(bytes,a,entry.source_frames);
     for(const t of a.turns??[]){const v=voices.get(t.voice_id);if(!v||v.version_code!==t.voice_version_code||!isDeepStrictEqual(v.scope,a.scope))throw new Error('Turn voice scope mismatch');if(t.character_id){const c=characters.get(t.character_id);if(!c||c.version_code!==t.character_version_code||c.voice_id!==t.voice_id||c.voice_version_code!==t.voice_version_code||!isDeepStrictEqual(c.scope,a.scope))throw new Error('Turn character scope mismatch');}}
    }
    entries.push({...entry,bytes,batch_id:group.batch.id});
   }
  }
  if(count!==group.batch.expected_assets)throw new Error('Batch inventory mismatch');
 }
 const assets=new Map(entries.map(e=>[e.metadata.asset_id,e.metadata]));
 for(const {metadata:a} of entries)if(a.speed==='slow'){
  const normal=assets.get(a.normal_asset_id!),strip=(t:AssetVersion['turns'])=>t?.map(x=>Object.fromEntries(Object.entries(x).filter(([k])=>k!=='start_ms'&&k!=='end_ms')));
  if(!normal||normal.asset_version!==a.normal_asset_version||normal.speed!=='normal'||normal.script_hash!==a.script_hash||normal.transcript!==a.transcript||!isDeepStrictEqual(normal.scope,a.scope)||!isDeepStrictEqual(strip(normal.turns),strip(a.turns)))throw new Error('Slow/normal identity mismatch');
 }
 return {registry,audio_bytes_verified:options.metadataOnly!==true,entries:entries.sort((a,b)=>Number(a.metadata.speed==='slow')-Number(b.metadata.speed==='slow'))};
}
export type LoadedMediaLibrary=Awaited<ReturnType<typeof loadMediaLibrary>>;
const stableId=(namespace:string,value:string)=>{const b=createHash('sha256').update(namespace+'\0'+value).digest().subarray(0,16);b[6]=(b[6]!&15)|128;b[8]=(b[8]!&63)|128;const h=b.toString('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);};
export async function importMediaLibrary(media:MediaRepository,actor:string,library:LoadedMediaLibrary,onProgress?:(done:number,total:number)=>void){
 if(!library.audio_bytes_verified)throw new Error('Full audio byte verification is required before import');
 for(const v of library.registry.voices)await media.registerVoice(actor,v);for(const c of library.registry.characters)await media.registerCharacter(actor,c);for(const g of library.registry.batches)await media.registerLibraryBatch(actor,g.batch);
 const outputs=[];let done=0;
 for(const e of library.entries){const a=e.metadata,id=stableId('p5-library-requirement',e.batch_id+':'+a.asset_id+':'+a.asset_version),key=stableId('p5-library-import',e.batch_id+':'+a.asset_id+':'+a.asset_version);
  await media.declareRequirement(actor,{id,library_batch_id:e.batch_id,role:a.stable_code,required:true,kind:a.kind,scope:a.scope,specification_version:a.version_code,specification:'Immutable source '+e.file+'; sha256 '+a.checksum,accessibility_role:a.decorative?'decorative':'semantic'});
  const job=await media.enqueueLibraryImport(actor,id,key,a.rights.generator_version);outputs.push(await media.ingest(actor,job,a,e.bytes));onProgress?.(++done,library.entries.length);
 }
 return outputs;
}
