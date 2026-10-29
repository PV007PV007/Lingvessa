/// <reference lib="dom" />
import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const manifest=JSON.parse(readFileSync('artifacts/p5/visual-review-manifest.json','utf8'));
const url=pathToFileURL(resolve('artifacts/p5',manifest.html_file)).href;
const hash=(data:Buffer)=>createHash('sha256').update(data).digest('hex');
const exportNotes=async(page:Page)=>{const waiting=page.waitForEvent('download');await page.locator('#export').click();return JSON.parse(readFileSync((await(await waiting).path())!,'utf8'));};
const importNotes=async(page:Page,value:unknown)=>page.locator('#import').setInputFiles({name:'notes.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});

test('all 30 unchanged visual versions decode offline with exact descriptions',async({page})=>{
 const external:string[]=[],errors:string[]=[];page.on('request',r=>{if(/^https?:/u.test(r.url()))external.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 expect(hash(readFileSync(resolve('artifacts/p5',manifest.html_file)))).toBe(manifest.html_sha256);
 await page.goto(url);await expect(page.locator('.card img')).toHaveCount(30);
 for(const item of manifest.items){const img=page.locator('#'+item.id+' img'),src=await img.getAttribute('src');
  expect(src?.startsWith('data:image/svg+xml;base64,')).toBe(true);expect(hash(Buffer.from(src!.split(',')[1]!,'base64'))).toBe(item.metadata.checksum);
  expect(hash(readFileSync(item.file))).toBe(item.metadata.checksum);await expect(img).toHaveAttribute('alt',item.metadata.alt_text);
  const dimensions=await img.evaluate(async e=>{const image=e as HTMLImageElement;await image.decode();return [image.naturalWidth,image.naturalHeight];});
  expect(dimensions).toEqual([item.metadata.width,item.metadata.height]);
 }
 await expect(page.locator('#progress-text')).toHaveText('0 із 30 матеріалів переглянуто');
 await page.locator('#language').selectOption('cs');await expect(page.locator('.card:visible')).toHaveCount(15);
 await page.locator('#language').selectOption('all');expect(external).toEqual([]);expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/p5/visual-review-desktop.png'});
 await page.locator('#visual-2').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/p5/visual-review-morning.png'});
 writeFileSync('artifacts/p5/visual-review-validation.json',JSON.stringify({status:'PASS',source_sha:manifest.source_sha,working_tree_dirty:manifest.working_tree_dirty,html_sha256:manifest.html_sha256,visuals_verified:30,external_requests:0,human_review:'PENDING',rights_approval:'PENDING',publication_ready:false,p6_authorized:false},null,2)+'\n');
});

test('feedback is version-bound, rejects tampering and cannot create approvals',async({page})=>{
 await page.goto(url);const blank=await exportNotes(page);expect(blank.completed_items).toBe(0);
 for(const field of ['quality','accessibility','rights'])await page.locator('#visual-1-'+field).selectOption('looks_ok');
 await page.locator('#visual-1-notes').fill('<script>alert(1)</script> — точне зауваження');
 const partial=await exportNotes(page);expect(partial.completed_items).toBe(1);expect(partial.feedback_status).toBe('PARTIAL');
 for(const kind of ['hash','version','source','approval','field']){
  const bad=structuredClone(partial);
  if(kind==='hash')bad.bindings[0].checksum='0'.repeat(64);
  if(kind==='version')bad.bindings[0].asset_version=1;
  if(kind==='source')bad.source_sha='0'.repeat(40);
  if(kind==='approval')bad.publication_ready=true;
  if(kind==='field')bad.feedback.items[0].rights='approved';
  await importNotes(page,bad);await expect(page.locator('#status')).toHaveAttribute('data-error','true');
  await expect(page.locator('#visual-1-notes')).toHaveValue(partial.feedback.items[0].notes);
 }
 await page.reload();await expect(page.locator('#visual-1-notes')).toHaveValue(partial.feedback.items[0].notes);
 await page.locator('#visual-1-notes').fill('Поточний текст');await importNotes(page,partial);await page.locator('#import-cancel').click();await expect(page.locator('#visual-1-notes')).toHaveValue('Поточний текст');
 partial.completed_items=30;await importNotes(page,partial);await page.locator('#import-apply').click();await expect(page.locator('#progress-text')).toHaveText('1 із 30 матеріалів переглянуто');
 const complete=structuredClone(partial);for(const row of complete.feedback.items)for(const field of ['quality','accessibility','rights'])row[field]='looks_ok';
 await importNotes(page,complete);await page.locator('#import-apply').click();const exported=await exportNotes(page);
 expect(exported.completed_items).toBe(30);expect(exported.feedback_status).toBe('RECORDED_UNAPPROVED');expect(exported.publication_ready).toBe(false);expect(exported.rights_approval).toBe('PENDING');expect(exported.p6_authorized).toBe(false);
 expect(await page.locator('.card img').count()).toBe(30);
});

test('mobile keyboard and export/import work when local storage is blocked',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
 await page.goto(url);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#visual-1-quality').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');await expect(page.locator('#visual-1-accessibility')).toBeFocused();
 await page.locator('#visual-1-notes').fill('Збереження без localStorage');await expect(page.locator('#storage-status')).toContainText('не дозволяє автозбереження');
 const notes=await exportNotes(page);await page.reload();await expect(page.locator('#visual-1-notes')).toHaveValue('');
 await importNotes(page,notes);await page.locator('#import-apply').click();await expect(page.locator('#visual-1-notes')).toHaveValue(notes.feedback.items[0].notes);
 await page.locator('#visual-1').scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'artifacts/p5/visual-review-mobile.png'});
});
