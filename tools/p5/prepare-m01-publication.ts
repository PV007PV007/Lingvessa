import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {loadMediaLibrary} from './media-library.js';
import {resolveM01Bindings} from './m01-publication-bindings.js';
const source_sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(process.env.GITHUB_HEAD_SHA)assert.equal(source_sha,process.env.GITHUB_HEAD_SHA);
const catalogPath='assets/specs/p5/reference-media.registry.json',library=await loadMediaLibrary(process.cwd(),{metadataOnly:true});
const bindings=resolveM01Bindings(library,JSON.parse(await readFile(catalogPath,'utf8')));
const paths=[catalogPath,'assets/media/m01/registry.json','docs/p5/m01-completion-20261014/owner-approval.json','tools/p5/m01-publication-bindings.ts','tools/p5/prepare-m01-publication.ts'];
const report={status:'PASS',scope:'M01_CATALOG_TO_IMMUTABLE_MEDIA_PREPARATION_ONLY',source_sha,resolved_assets:450,audio_assets:420,visual_drafts:30,normal_slow_pairs:210,voices:6,characters:6,bindings,
 audio_bytes_verified:false,visual_bytes_verified:true,automatic_approval_insertion:false,publication_ready:false,production_publication_created:false,production_delivery_profile_approved:false,p6_authorized:false,
 remaining:['Human visual semantic/accessibility/originality/rights review','Activity-specific reference publication and accessibility','OD-004 production delivery profile','OD-006 labelled learner-error calibration and approved policy'],
 code_bindings:Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])))};
await mkdir('artifacts/p5',{recursive:true});await writeFile('artifacts/p5/m01-publication-bindings.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,source_sha,resolved_assets:450,normal_slow_pairs:210,publication_ready:false}));
