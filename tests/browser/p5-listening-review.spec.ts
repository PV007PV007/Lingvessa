/// <reference lib="dom" />
import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

interface Clip {id:string;path:string;sha256:string;duration_seconds:number}
interface Pair {id:string;clips:Clip[]}
const manifest=JSON.parse(readFileSync('artifacts/p5/listening-review-manifest.json','utf8')) as {
  html_file:string;html_sha256:string;source_sha:string;working_tree_dirty:boolean;pairs:Pair[];anchors:Clip[];
};
const url=pathToFileURL(resolve('artifacts/p5',manifest.html_file)).href;
const sha256=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const exportNotes=async(page:Page)=>{
  const downloaded=page.waitForEvent('download');
  await page.locator('#export').click();
  const path=await(await downloaded).path();
  expect(path).toBeTruthy();
  return JSON.parse(readFileSync(path!,'utf8'));
};
const importNotes=async(page:Page,value:unknown)=>page.locator('#import').setInputFiles({
  name:'notes.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value)),
});

test('all 18 immutable WAVs decode and advance, playback is exclusive and the file stays offline',async({page})=>{
  const errors:string[]=[];
  const external:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/^https?:/u.test(request.url()))external.push(request.url());});
  expect(sha256(readFileSync(resolve('artifacts/p5',manifest.html_file)))).toBe(manifest.html_sha256);
  await page.goto(url);
  await expect(page.locator('audio')).toHaveCount(18);
  expect(await page.locator('audio').evaluateAll(elements=>elements.every(e=>(e as HTMLAudioElement).paused))).toBe(true);
  await page.getByRole('heading',{level:1}).click();
  const measurements=[];
  const clips=[...manifest.pairs.flatMap(pair=>pair.clips),...manifest.anchors];
  for(const clip of clips){
    const audio=page.locator('#'+clip.id);
    const encoded=await audio.getAttribute('src');
    expect(encoded?.startsWith('data:audio/wav;base64,')).toBe(true);
    expect(sha256(Buffer.from(encoded!.split(',')[1]!,'base64'))).toBe(clip.sha256);
    expect(sha256(readFileSync(clip.path))).toBe(clip.sha256);
    await audio.evaluate(element=>(element as HTMLAudioElement).play());
    await expect.poll(()=>audio.evaluate(element=>(element as HTMLAudioElement).currentTime)).toBeGreaterThan(0.08);
    const measurement=await audio.evaluate(element=>{const a=element as HTMLAudioElement;return {id:a.id,duration:a.duration,current_time:a.currentTime,error:a.error?.code??null};});
    expect(Math.abs(measurement.duration-clip.duration_seconds)).toBeLessThan(0.02);
    expect(measurement.error).toBeNull();
    expect(await page.locator('audio').evaluateAll(elements=>elements.filter(e=>!(e as HTMLAudioElement).paused).length)).toBe(1);
    measurements.push(measurement);
  }
  await page.locator('audio').evaluateAll(elements=>elements.forEach(e=>(e as HTMLAudioElement).pause()));
  expect(external).toEqual([]);expect(errors).toEqual([]);
  await expect(page.locator('#progress-text')).toHaveText('0 із 8 порівнянь заповнено');
  await page.screenshot({path:'artifacts/p5/listening-review-desktop.png'});
  writeFileSync('artifacts/p5/listening-playback-validation.json',JSON.stringify({
    status:'PASS',source_sha:manifest.source_sha,working_tree_dirty:manifest.working_tree_dirty,
    html_sha256:manifest.html_sha256,clips_verified:18,measurements,external_requests:0,
    human_review:'PENDING',publication_ready:false,p5_milestone:'NOT_READY',p6_authorized:false,
  },null,2)+'\n');
});

test('partial and complete feedback export without approval; reload and validated import preserve notes',async({page})=>{
  await page.goto(url);
  const blank=await exportNotes(page);
  expect(blank.completed_comparisons).toBe(0);expect(blank.feedback_status).toBe('PARTIAL');
  await page.locator('#czech-level').selectOption('learning');
  await page.locator('#pair-1-choice').selectOption('X');
  await page.locator('#pair-1-notes').fill('X: Děkuji, 0:04. <img src=x onerror=alert(1)>');
  await expect(page.locator('#progress-text')).toHaveText('0 із 8 порівнянь заповнено');
  await page.locator('#pair-1-listened').check();
  const partial=await exportNotes(page);
  expect(partial.completed_comparisons).toBe(1);expect(partial.feedback_status).toBe('PARTIAL');
  expect(partial.publication_ready).toBe(false);expect(partial.p6_authorized).toBe(false);expect(partial.p5_milestone).toBe('NOT_READY');
  expect(partial.bindings[0].clips[0].sha256).toBe(manifest.pairs[0]!.clips[0]!.sha256);
  await page.reload();
  await expect(page.locator('#pair-1-notes')).toHaveValue(partial.feedback.comparisons[0].notes);
  await expect(page.locator('#progress-text')).toHaveText('1 із 8 порівнянь заповнено');
  const wrong=structuredClone(partial);wrong.bindings[0].clips[0].sha256='0'.repeat(64);
  await importNotes(page,wrong);await expect(page.locator('#action-status')).toHaveAttribute('data-error','true');
  await expect(page.locator('#pair-1-notes')).toHaveValue(partial.feedback.comparisons[0].notes);
  await page.locator('#pair-1-notes').fill('Current notes');
  await importNotes(page,partial);await page.locator('#import-cancel').click();
  await expect(page.locator('#pair-1-notes')).toHaveValue('Current notes');
  partial.completed_comparisons=8;partial.feedback_status='RECORDED_UNAPPROVED';
  await importNotes(page,partial);await page.locator('#import-apply').click();
  await expect(page.locator('#pair-1-notes')).toHaveValue(partial.feedback.comparisons[0].notes);
  await expect(page.locator('#progress-text')).toHaveText('1 із 8 порівнянь заповнено');
  await expect(page.locator('img')).toHaveCount(0);
  for(let i=2;i<=8;i++){await page.locator(`#pair-${i}-choice`).selectOption('unsure');await page.locator(`#pair-${i}-listened`).check();}
  const complete=await exportNotes(page);
  expect(complete.completed_comparisons).toBe(8);expect(complete.feedback_status).toBe('RECORDED_UNAPPROVED');
  expect(complete.publication_ready).toBe(false);expect(complete.p5_milestone).toBe('NOT_READY');
  expect(complete.p6_authorized).toBe(false);
});

test('mobile keyboard use and denied storage keep export and import available',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});
  });
  await page.goto(url);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#pair-1-choice').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');
  await expect(page.locator('#pair-1-listened')).toBeFocused();await page.keyboard.press('Space');
  await page.locator('#pair-1-notes').fill('Notes survive through export when storage is blocked.');
  await expect(page.locator('#storage-status')).toContainText('не дозволяє автозбереження');
  const notes=await exportNotes(page);expect(notes.completed_comparisons).toBe(1);
  await page.reload();await expect(page.locator('#pair-1-notes')).toHaveValue('');
  await importNotes(page,notes);await page.locator('#import-apply').click();
  await expect(page.locator('#pair-1-notes')).toHaveValue(notes.feedback.comparisons[0].notes);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#batch-1').scrollIntoViewIfNeeded();
  await page.screenshot({path:'artifacts/p5/listening-review-mobile.png'});
});
