import {mkdir,writeFile} from 'node:fs/promises';
import {loadMediaLibrary} from './media-library.js';
const library=await loadMediaLibrary(process.cwd(),{metadataOnly:true});
const report={status:'PASS',scope:'M01_APPROVED_MEDIA_METADATA_AND_SVG_BYTES',source_sha:process.env.GITHUB_HEAD_SHA??null,audio_assets:library.entries.filter(e=>e.metadata.kind==='audio').length,visual_drafts:library.entries.filter(e=>e.metadata.kind!=='audio').length,voices:library.registry.voices.length,characters:library.registry.characters.length,approved_dataset_sha256:library.registry.approved_dataset_sha256,audio_bytes_verified:false,visual_bytes_verified:true,approval_insertion:false,production_publication_created:false,p6_authorized:false};
await mkdir('artifacts/p5',{recursive:true});await writeFile('artifacts/p5/approved-media-metadata-validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
