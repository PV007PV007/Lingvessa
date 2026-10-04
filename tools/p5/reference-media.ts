import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {z} from 'zod';
import {assetVersionSchema} from '../../packages/activity-schemas/src/media.js';
import {UUID_PATTERN,STABLE_CODE_PATTERN} from '../../packages/domain/src/identity.js';
import {validateAssetBytes} from '../../packages/provider-adapters/storage/asset-integrity.js';

const uuid=z.string().regex(UUID_PATTERN),code=z.string().regex(STABLE_CODE_PATTERN),language=z.enum(['en','cs']);
const base={id:uuid,stable_code:code,language};
const scene=z.object({...base,kind:z.literal('image'),theme:z.enum(['club','morning','evening','class','formal','informal']),alt_text:z.string().min(1)}).strict();
const character=z.object({...base,kind:z.literal('avatar'),character_id:uuid,name:z.string(),adult:z.literal(true),role:z.enum(['peer','teacher']),skin:z.enum(['warm brown','medium brown','light brown']),hair:z.enum(['curly','short','bob','long']),voice_code:code,alt_text:z.string().min(1)}).strict();
const icon=z.object({...base,kind:z.literal('vector'),theme:z.enum(['thanks','unclear','repeat']),alt_text:z.string().min(1)}).strict();
const flag=z.object({...base,kind:z.literal('vector'),country:z.enum(['GB','UA','CZ','PL','DE','SK','ES']),alt_text:z.string().min(1),status:z.literal('draft_geometry_prepared')}).strict();
const voice=z.object({...base,variety:z.enum(['en-GB','cs-CZ']),version_code:z.literal('draft-1'),role:z.string(),adult:z.literal(true),real_person_clone:z.literal(false),provider_adapter:z.null(),model_version:z.null(),licence_evidence:z.null(),status:z.literal('pending_OD-005')}).strict();
const turn=z.object({speaker:code,voice_code:code,text:z.string().min(1),character_id:uuid.optional(),character_asset_code:code.optional()}).strict();
const script=z.object({...base,variety:z.enum(['en-GB','cs-CZ']),version_code:z.literal('draft-1'),kind:z.enum(['word_or_chunk','dialogue']),turns:z.array(turn).min(1),performance_note:z.string()}).strict();
const sourceSchema=z.object({schema_version:z.literal('p5-reference-media-source-1'),version_code:z.literal('draft-1'),publication_ready:z.literal(false),source_document:z.literal('Lingvessa_Reference_Module_Design.pdf'),source_version:z.literal('1.6'),source_sections:z.array(z.string()),scope:z.string(),style:z.string(),scenes:z.array(scene),characters:z.array(character),icons:z.array(icon),flags:z.array(flag),voices:z.array(voice),scripts:z.array(script)}).strict();
const sourcePath='assets/specs/p5/reference-media.source.json',source=sourceSchema.parse(JSON.parse(readFileSync(sourcePath,'utf8')));
const digest=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
// Fixed authoring namespace allocates concrete opaque IDs; runtime never derives IDs from codes.
function id(key:string){const b=createHash('sha1').update(Buffer.from('693d697e1fdf5bb891fbe7ef4c856694','hex')).update(key).digest().subarray(0,16);b[6]=(b[6]!&15)|80;b[8]=(b[8]!&63)|128;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
const scope=(l:'en'|'cs')=>({language:l,variety:l==='en'?'common' as const:'cs-CZ' as const});
function svg(width:number,height:number,alt:string,body:string){if(/[<>&]/u.test(alt))throw new Error('Unsafe SVG title');return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>${alt}</title>${body}</svg>`;}
function person(x:number,y:number,scale:number,skin:string,shirt:string,hair='short',wave=false){
 const back=hair==='long'||hair==='bob'?'<rect x="18" y="8" width="64" height="80" rx="28" fill="#292d37"/>':'';
 const top=hair==='curly'?'<circle cx="31" cy="20" r="18" fill="#292d37"/><circle cx="50" cy="11" r="19" fill="#292d37"/><circle cx="69" cy="20" r="18" fill="#292d37"/>':'<path d="M20 39 Q16 2 51 2 Q82 4 80 39 L69 22 Q42 33 20 39" fill="#292d37"/>';
 return `<g transform="translate(${x} ${y}) scale(${scale})">${back}<path d="M19 154 L13 251 L36 251 L51 164 L64 251 L86 251 L79 154" fill="#253c52"/><rect x="38" y="55" width="25" height="31" rx="10" fill="${skin}"/><path d="M21 79 Q50 69 78 80 L90 169 L10 169 Z" fill="${shirt}"/><ellipse cx="50" cy="40" rx="29" ry="35" fill="${skin}"/>${top}<circle cx="40" cy="43" r="2.6" fill="#242938"/><circle cx="62" cy="43" r="2.6" fill="#242938"/><path d="M42 57 Q50 63 59 56" fill="none" stroke="#6d463f" stroke-width="3" stroke-linecap="round"/>${wave?`<path d="M22 89 L-4 114 L-25 60" fill="none" stroke="${skin}" stroke-width="13" stroke-linecap="round"/><path d="M-25 60 L-31 45 M-25 60 L-21 43" stroke="${skin}" stroke-width="8" stroke-linecap="round"/>`:`<path d="M19 89 L-2 153" fill="none" stroke="${skin}" stroke-width="13" stroke-linecap="round"/>`}<path d="M81 89 L104 151" fill="none" stroke="${skin}" stroke-width="13" stroke-linecap="round"/><path d="M13 251 H38 M64 251 H88" stroke="#182c3b" stroke-width="12" stroke-linecap="round"/></g>`;
}
function renderScene(s:z.infer<typeof scene>){
 const evening=s.theme==='evening',outdoor=['morning','evening'].includes(s.theme),formal=s.theme==='formal',informal=s.theme==='informal';
 const sky=evening?'#263b62':s.theme==='morning'?'#ffdfb4':'#dbeee8';
 let body=`<rect width="960" height="540" rx="24" fill="${sky}"/><path d="M0 392 Q400 360 960 401 V540 H0Z" fill="${evening?'#516074':'#d3d7bf'}"/>`;
 if(outdoor)body+=evening?'<circle cx="756" cy="103" r="32" fill="#fff0c9"/><circle cx="770" cy="90" r="30" fill="#263b62"/><circle cx="89" cy="71" r="3" fill="#fff0c9"/><circle cx="407" cy="96" r="3" fill="#fff0c9"/>':'<circle cx="770" cy="142" r="63" fill="#ffc75f"/><path d="M404 473 L770 433 L850 453 L475 500Z" fill="#baa78f"/>';
 if(!outdoor||evening)body+=`<rect x="65" y="69" width="305" height="339" rx="14" fill="${evening?'#758397':'#f6f2e8'}"/><rect x="116" y="122" width="159" height="286" rx="5" fill="${evening?'#ffe2a0':'#36786f'}"/><path d="M116 122 L186 147 V408 H116Z" fill="#7fad91"/><circle cx="172" cy="265" r="4" fill="#e3bf83"/>`;
 if(s.theme==='class')body+='<rect x="585" y="80" width="299" height="166" rx="12" fill="#fcfff9" stroke="#4c8174" stroke-width="12"/><path d="M617 264 H850" stroke="#4c8174" stroke-width="12" stroke-linecap="round"/>';
 body+='<ellipse cx="453" cy="492" rx="92" ry="17" fill="#98b1a3"/><ellipse cx="694" cy="492" rx="92" ry="17" fill="#98b1a3"/>';
 const codes=s.language==='en'?['AV_ENG_MAYA_01','AV_ENG_DANIEL_01']:formal?['AV_CZE_OKSANA_01','AV_CZE_KLARA_01']:informal?['AV_CZE_ADAM_01','AV_CZE_OKSANA_01']:['AV_CZE_KLARA_01','AV_CZE_OKSANA_01'];
 const people=codes.map(code=>source.characters.find(c=>c.stable_code===code)!);
 body+=people.map((c,i)=>person(i===0?378:644,145,1.35,palette(c).skin,palette(c).shirt,c.hair,i===0&&!formal)).join('');
 if(formal)body+='<rect x="552" y="346" width="325" height="129" rx="12" fill="#cbb8a0"/><rect x="535" y="339" width="357" height="19" rx="7" fill="#76584c"/>';
 if(informal)body+='<ellipse cx="570" cy="345" rx="99" ry="28" fill="#cb976d"/><path d="M542 365 L521 495 M595 365 L613 495" stroke="#76584c" stroke-width="13"/>';
 body+='<rect x="829" y="356" width="65" height="104" rx="12" fill="#b9775d"/><path d="M862 366 C776 322 824 276 855 327 C818 231 906 250 869 330 C931 261 951 337 872 365" fill="#407a65"/>';
 return svg(960,540,s.alt_text,body);
}
function palette(c:z.infer<typeof character>){return {skin:{'warm brown':'#be805e','medium brown':'#997052','light brown':'#dab395'}[c.skin],shirt:c.role==='teacher'?'#5a648d':c.name==='Maya'?'#bb5a4b':c.name==='Oksana'?'#a65b43':c.name==='Daniel'?'#47778b':'#286961'};}
function renderAvatar(c:z.infer<typeof character>){return svg(320,320,c.alt_text,`<rect width="320" height="320" rx="44" fill="#e4efe8"/><circle cx="160" cy="148" r="125" fill="#ccd9bd"/>${person(80,39,1.6,palette(c).skin,palette(c).shirt,c.hair)}`);}
function renderIcon(s:z.infer<typeof icon>){const body=s.theme==='repeat'?'<path d="M50 106 A74 74 0 0 1 184 74 L201 96 M201 63 V98 H169 M205 151 A74 74 0 0 1 70 190 L53 169 M53 203 V167 H85" fill="none" stroke="#286961" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>':s.theme==='thanks'?'<path d="M123 100 C65 51 73 15 110 23 Q133 21 139 42 Q158 9 181 24 C219 45 201 82 153 115Z" fill="#bb5a4b"/><path d="M48 185 L89 154 L128 166 L170 137 Q190 143 170 165 L128 208 L74 216Z" fill="#bb956b"/>':'<path d="M34 45 H152 V130 H93 L67 159 V130 H34Z M122 150 H223 V215 H192 L207 242 L164 215 H122" fill="none" stroke="#286961" stroke-width="11" stroke-linejoin="round"/><path d="M64 87 H88 M113 87 H128 M147 180 H165 M183 180 H203" stroke="#bb5a4b" stroke-width="9" stroke-linecap="round"/>';return svg(256,256,s.alt_text,`<rect width="256" height="256" rx="32" fill="#f7f2e7"/>${body}`);}

const outputs=new Map<string,string>(),visuals=[];const allCodes=new Set<string>(),allIds=new Set<string>();
for(const entry of [...source.scenes,...source.characters,...source.icons,...source.flags,...source.voices,...source.scripts]){
 const key=`${entry.language}:${entry.stable_code}`;if(allCodes.has(key)||allIds.has(entry.id))throw new Error('Duplicate reference media identity');allCodes.add(key);allIds.add(entry.id);
 if('variety'in entry&&entry.variety!==(entry.language==='en'?'en-GB':'cs-CZ'))throw new Error('Reference variety mismatch');
}
for(const c of source.characters)if(!source.voices.some(v=>v.language===c.language&&v.stable_code===c.voice_code))throw new Error('Unresolved character voice');
for(const s of [...source.scenes,...source.characters,...source.icons]){
 const bytes=s.kind==='image'?renderScene(s):s.kind==='avatar'?renderAvatar(s):renderIcon(s),path=`assets/specs/p5/generated/${s.language}/${s.stable_code}.svg`;
 const a=assetVersionSchema.parse({asset_id:s.id,stable_code:s.stable_code,asset_version:1,version_code:'draft-1',kind:s.kind,...(s.kind==='avatar'?{character_id:s.character_id,character_version_code:'draft-1'}:{}),scope:scope(s.language),purpose:'Original M01 reference media draft; not approved for publication',mime:'image/svg+xml',checksum:digest(bytes),byte_length:Buffer.byteLength(bytes),width:s.kind==='image'?960:s.kind==='avatar'?320:256,height:s.kind==='image'?540:s.kind==='avatar'?320:256,decorative:false,alt_text:s.alt_text,rights:{licence:'Original Lingvessa project artwork; unpublished draft pending owner rights review',provenance:'Programmatic source in tools/p5/reference-media.ts and the versioned source catalog; fictional adults; no external image/person/voice input',source_kind:'programmatic',generator_version:'p5-vector-1',spec_hash:digest(JSON.stringify(s)),real_person_clone:false}});
 validateAssetBytes(Buffer.from(bytes),a.mime,a.checksum);outputs.set(path,bytes);visuals.push({metadata:a,file:path,qa_status:'pending_human_review',reviewer:null});
}
const audio=[];
for(const s of source.flags){
 const file=`assets/specs/p5/flags/normalized/${s.country.toLowerCase()}.svg`,bytes=readFileSync(file),text=bytes.toString('utf8');
 const width=Number(/\bwidth="(\d+)"/u.exec(text)?.[1]),height=Number(/\bheight="(\d+)"/u.exec(text)?.[1]);
 const metadata=assetVersionSchema.parse({asset_id:s.id,stable_code:s.stable_code,asset_version:1,version_code:'draft-1',kind:'vector',scope:scope(s.language),purpose:'National flag reference draft; native proportions; pending human geometry/rights QA',mime:'image/svg+xml',checksum:digest(bytes),byte_length:bytes.length,width,height,decorative:false,alt_text:s.alt_text,rights:{licence:'Upstream declares national flag images public domain; project rights review pending; see flags/provenance.json',provenance:'svg-country-flags@1.2.10 pinned source; expanded local references and flattened clipping with tools/p5/normalize-flags.py; source hashes and upstream attribution retained',source_kind:'licensed',generator_version:'p5-flags-static-1',spec_hash:digest(JSON.stringify(s)),real_person_clone:false}});
 validateAssetBytes(bytes,metadata.mime,metadata.checksum);visuals.push({metadata,file,qa_status:'pending_human_review',reviewer:null});
}
for(const s of source.scripts){
 for(const t of s.turns){if(t.text!==t.text.normalize('NFC'))throw new Error('Script text must be NFC');if(!source.voices.some(v=>v.language===s.language&&v.stable_code===t.voice_code))throw new Error('Unresolved script voice');if(t.character_id&&!source.characters.some(c=>c.language===s.language&&c.character_id===t.character_id&&c.stable_code===t.character_asset_code&&c.voice_code===t.voice_code))throw new Error('Speaker/character/voice mismatch');}
 const turns=s.turns.map((t,i)=>({...t,turn_id:id(`${s.id}:turn:${i}`)}));
 const selections=[{code:s.stable_code,turns},...(s.kind==='dialogue'?turns.map((t,i)=>({code:`${s.stable_code}_TURN_${String(i+1).padStart(2,'0')}`,turns:[t]})):[])];
 for(const sel of selections)for(const speed of ['normal','slow'] as const){const stable=sel.code+(speed==='slow'?'_SLOW':'');audio.push({asset_id:id(`${s.language}:ASSET:${stable}`),stable_code:stable,asset_version:1,version_code:'draft-1',language:s.language,variety:s.variety,kind:'audio',speed,normal_asset_id:speed==='slow'?id(`${s.language}:ASSET:${sel.code}`):null,script_id:s.id,script_hash:digest(JSON.stringify(sel.turns)),transcript:sel.turns.map(t=>t.text).join('\n'),turns:sel.turns.map(t=>({...t,voice_id:source.voices.find(v=>v.language===s.language&&v.stable_code===t.voice_code)!.id})),status:'pending_approved_voice_generation_and_QA',file:null,checksum:null,duration_ms:null,loudness_lufs:null});}
}
const registry={schema_version:'p5-reference-media-registry-1',version_code:source.version_code,source_path:sourcePath,source_checksum:digest(readFileSync(sourcePath)),publication_ready:false,visuals,flags:source.flags,voices:source.voices,audio,characters:source.characters,unresolved:['OD-005 approved TTS voice/model/licence; actual normal/slow audio + measured duration/loudness/turn timestamps','Human semantic/geometric/linguistic/accessibility/originality/rights review before publication','OD-004 approved delivery profile before production integration','OD-006 calibrated real speech policy; scoring remains unavailable by default']};
outputs.set('assets/specs/p5/reference-media.registry.json',JSON.stringify(registry,null,2)+'\n');
for(const [path,text]of outputs){if(process.argv.includes('--write')){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,text);}else if(readFileSync(path,'utf8')!==text)throw new Error(`Reference media output drift: ${path}`);}
const report={phase:'P5',scope:'Media preparation, not P6/P7 runtime/publication',source_sha:process.env.GITHUB_HEAD_SHA??null,structural_validation:'PASS',publication_ready:false,original_visual_drafts:visuals.filter(v=>v.metadata.rights.source_kind==='programmatic').length,flag_drafts:source.flags.length,script_count:source.scripts.length,audio_slots:audio.length,voice_profiles:source.voices.length,approved_assets:0,unresolved:registry.unresolved};
mkdirSync('artifacts/p5',{recursive:true});writeFileSync('artifacts/p5/reference-media-validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
if(process.argv.includes('--require-ready'))process.exitCode=1;
