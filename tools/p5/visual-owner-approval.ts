import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {LoadedMediaLibrary} from './media-library.js';

export const visualApprovalPath='docs/p5/visual-approval-20261020/owner-approval.json';
export const visualApprovalSha256='027b3fa9736188e11fa703361bbb5024958f49897e5be276db8fc6983e11d24c';
export const reviewedManifestPath='docs/p5/visual-approval-20261020/reviewed-manifest.json';
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');

/** A later set-level owner decision overlays immutable draft records. No runtime approvals are inserted. */
export async function verifyVisualOwnerApproval(root:string,library:LoadedMediaLibrary){
 const decisionBytes=await readFile(join(root,visualApprovalPath));
 assert.equal(digest(decisionBytes),visualApprovalSha256,'Owner visual decision changed');
 const decision=JSON.parse(decisionBytes.toString('utf8'));
 assert.equal(decision.status,'OWNER_APPROVED');assert.equal(decision.approved_visual_assets,30);
 assert.equal(decision.reviewed_manifest_path,reviewedManifestPath);
 const manifestBytes=await readFile(join(root,reviewedManifestPath));
 assert.equal(digest(manifestBytes),decision.reviewed_manifest_sha256);
 const manifest=JSON.parse(manifestBytes.toString('utf8')) as {source_sha:string;html_sha256:string;review_set_sha256:string;items:Array<{file:string;metadata:LoadedMediaLibrary['entries'][number]['metadata'];record_path:string;record_sha256:string}>};
 assert.equal(manifest.source_sha,decision.reviewed_source_sha);assert.equal(manifest.html_sha256,decision.reviewed_html.sha256);
 assert.equal(manifest.review_set_sha256,decision.review_set_sha256);
 const visuals=library.entries.filter(e=>e.metadata.kind!=='audio');assert.equal(visuals.length,30);assert.equal(manifest.items.length,30);
 assert.equal(new Set(manifest.items.map(i=>i.metadata.asset_id)).size,30);
 assert.equal(new Set(visuals.map(e=>e.metadata.asset_id)).size,30);
 for(const item of manifest.items){
  const current=visuals.find(e=>e.metadata.asset_id===item.metadata.asset_id);assert(current,'Approved visual missing');
  assert.equal(current.file,item.file);assert.deepEqual(current.metadata,item.metadata,'Approved version or metadata changed');
  assert.equal(current.bytes.length,item.metadata.byte_length);assert.equal(digest(current.bytes),item.metadata.checksum,'Approved visual bytes changed');
  assert.equal(digest(await readFile(join(root,item.record_path))),item.record_sha256,'Immutable visual record changed');
 }
 return {status:'OWNER_APPROVED',scope:decision.scope,assets_verified:30,decision_path:visualApprovalPath,decision_sha256:visualApprovalSha256,
  reviewed_manifest_path:reviewedManifestPath,reviewed_manifest_sha256:decision.reviewed_manifest_sha256,reviewed_source_sha:manifest.source_sha,reviewed_html_sha256:manifest.html_sha256,
  per_item_form_submitted:false,runtime_approval_insertion:false,production_publication_authorized:false,production_delivery_profile_approved:false,od_004_closed:false,od_006_closed:false,p6_authorized:false};
}
