/// <reference lib="dom" />
import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

interface Slot {id:string;available:boolean;pace:string;sha256:string|null;path:string|null;duration:number|null;cues:{start:number}[]}
interface Pair {id:string;language:string;slots:Slot[]}
interface Feedback {
  scope:string;dataset_sha256:string;publication_ready:boolean;p5_milestone:string;p6_authorized:boolean;
  completed_files:number;feedback_status:string;bindings:{asset_id:string;sha256:string}[];
  feedback:{levels:{en:string;cs:string};records:{
    asset_id:string;listened:boolean;choice:string;issue:string;notes:string;updated_at:string|null;
  }[]};
}
const sha256=(data:Buffer)=>createHash('sha256').update(data).digest('hex');
const manifestPath='artifacts/p5/m01-review-fixture-manifest.json';
const manifest=JSON.parse(readFileSync(manifestPath,'utf8')) as {
  html_file:string;html_sha256:string;source_sha:string;working_tree_dirty:boolean;
  scope:string;builder_sha256:string;template_sha256:string;dataset_sha256:string;pairs:Pair[];
};
const url=pathToFileURL(resolve('artifacts/p5',manifest.html_file)).href;
const exportNotes=async(page:Page):Promise<Feedback>=>{
  const download=page.waitForEvent('download');await page.locator('#export').click();
  const path=await(await download).path();expect(path).toBeTruthy();
  return JSON.parse(readFileSync(path!,'utf8')) as Feedback;
};
const importNotes=async(page:Page,value:Feedback)=>page.locator('#import').setInputFiles({
  name:'notes.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value)),
});

test('the intake command accepts an actual browser export and keeps every approval gate open',async({page})=>{
  await page.goto(url);
  await page.locator('#normal-listened').check();
  await page.locator('#normal-choice').selectOption('needs_work');
  await page.locator('#normal-issue').selectOption('pace');
  await page.locator('#normal-notes').fill('ТЕСТ ІНТЕРФЕЙСУ: перевірити паузу; це не людський відгук M01.');
  const feedback=await exportNotes(page);
  const input='artifacts/p5/m01-feedback-browser-export.json';
  const output='artifacts/p5/m01-feedback-browser-intake.json';
  writeFileSync(input,JSON.stringify(feedback,null,2)+'\n');
  execFileSync('python3',['tools/p5/validate-m01-feedback.py','--test-fixture','--input',input,'--output',output],{encoding:'utf8'});
  const report=JSON.parse(readFileSync(output,'utf8'));
  expect(report.status).toBe('VALID');expect(report.scope).toBe('UI_TEST_FIXTURE');
  expect(report.source_sha).toBe(manifest.source_sha);expect(report.working_tree_dirty).toBe(false);
  expect(report.input_sha256).toBe(sha256(readFileSync(input)));
  expect(report.counts).toEqual({available_files:4,missing_files:2,completed_attestations:1,
    buckets:{needs_work:1,clarify:0,unreviewed:3,reported_no_issues:0}});
  expect(report.records[0].feedback).toEqual(feedback.feedback.records[0]);
  expect(report.review_provenance).toBe('UNVERIFIED_SELF_REPORT');
  expect(report.feedback_status).toBe('PARTIAL');
  expect(report.human_linguistic_approval).toBe('PENDING');expect(report.rights_approval).toBe('PENDING');
  expect(report.publication_ready).toBe(false);expect(report.p5_milestone).toBe('NOT_READY');expect(report.p6_authorized).toBe(false);
});

test('fixture playback, cue seeking and exclusive audio remain offline; no M01 byte QA is claimed',async({page})=>{
  const errors:string[]=[],external:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/^https?:/u.test(request.url()))external.push(request.url());});
  expect(manifest.scope).toBe('UI_TEST_FIXTURE');
  expect(sha256(readFileSync(resolve('artifacts/p5',manifest.html_file)))).toBe(manifest.html_sha256);
  await page.goto(url);await expect(page.locator('#fixture-warning')).toBeVisible();
  await expect(page.locator('#progress-text')).toHaveText('0 / 4');
  await expect(page.locator('.diagnostic[open]')).toHaveCount(0);
  await page.getByRole('heading',{level:1}).click();
  const measurements=[];
  for(const pair of manifest.pairs.filter(p=>p.slots.every(s=>s.available))){
    await page.locator('#language').selectOption(pair.language);
    await expect(page.locator('audio')).toHaveCount(2);
    for(const slot of pair.slots){
      const player=page.locator('#'+slot.pace+'-audio');
      const src=await player.getAttribute('src');
      expect(sha256(Buffer.from(src!.split(',')[1]!,'base64'))).toBe(slot.sha256);
      expect(sha256(readFileSync(slot.path!))).toBe(slot.sha256);
      await player.evaluate(e=>(e as HTMLAudioElement).play());
      await expect.poll(()=>player.evaluate(e=>(e as HTMLAudioElement).currentTime)).toBeGreaterThan(.08);
      const measured=await player.evaluate(e=>{const a=e as HTMLAudioElement;return {duration:a.duration,current_time:a.currentTime,error:a.error?.code??null};});
      expect(Math.abs(measured.duration-slot.duration!)).toBeLessThan(.02);expect(measured.error).toBeNull();
      expect(await page.locator('audio').evaluateAll(es=>es.filter(e=>!(e as HTMLAudioElement).paused).length)).toBe(1);
      measurements.push({id:slot.id,...measured});
    }
    await page.locator('.clip').first().locator('.cue-list button').nth(1).click();
    await expect.poll(()=>page.locator('#normal-audio').evaluate(e=>(e as HTMLAudioElement).currentTime)).toBeGreaterThan(pair.slots[0]!.cues[1]!.start-.02);
    expect(await page.locator('#slow-audio').evaluate(e=>(e as HTMLAudioElement).paused)).toBe(true);
  }
  await page.locator('#language').selectOption('en');
  expect(errors).toEqual([]);expect(external).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/p5/m01-review-desktop.png'});
  writeFileSync('artifacts/p5/m01-review-ui-validation.json',JSON.stringify({
    status:'PASS',source_sha:manifest.source_sha,working_tree_dirty:manifest.working_tree_dirty,
    scope:'UI_TEST_FIXTURE',fixture_wavs_verified:4,m01_audio_bytes_verified:false,m01_wavs_verified:0,
    html_sha256:manifest.html_sha256,manifest_sha256:sha256(readFileSync(manifestPath)),
    builder_sha256:manifest.builder_sha256,template_sha256:manifest.template_sha256,
    measurements,external_requests:0,human_review:'PENDING',publication_ready:false,p5_milestone:'NOT_READY',p6_authorized:false,
  },null,2)+'\n');
});

test('per-file feedback survives navigation, reload and import; tampered bindings and approvals are rejected',async({page})=>{
  await page.goto(url);
  const blank=await exportNotes(page);expect(blank.completed_files).toBe(0);
  await page.locator('#normal-choice').selectOption('needs_work');
  await page.locator('#normal-issue').selectOption('pronunciation');
  await page.locator('#normal-notes').fill('0:02, слово. <img src=x onerror=alert(1)>');
  await expect(page.locator('#progress-text')).toHaveText('0 / 4');
  await page.locator('#normal-listened').check();
  const partial=await exportNotes(page);expect(partial.completed_files).toBe(1);
  expect(partial.feedback_status).toBe('PARTIAL');expect(partial.publication_ready).toBe(false);
  expect(partial.p6_authorized).toBe(false);expect(partial.p5_milestone).toBe('NOT_READY');
  expect(partial.feedback.records[0]!.updated_at).toMatch(/Z$/u);
  await page.locator('#next').click();await page.locator('#previous').click();
  await expect(page.locator('#normal-notes')).toHaveValue(partial.feedback.records[0]!.notes);
  await page.reload();await expect(page.locator('#normal-notes')).toHaveValue(partial.feedback.records[0]!.notes);
  const attacks:((f:Feedback)=>void)[]=[
    f=>{f.bindings[0]!.sha256='0'.repeat(64);},
    f=>{f.dataset_sha256='0'.repeat(64);},
    f=>{f.scope='M01_DRAFT';},
    f=>{f.feedback.records[0]!.asset_id='fixture-missing-normal';},
    f=>{f.feedback.records[0]!.choice='APPROVED';},
    f=>{f.feedback.records[0]!.notes='x'.repeat(2001);},
    f=>{f.publication_ready=true;},
    f=>{f.p6_authorized=true;},
  ];
  for(const attack of attacks){
    const wrong=structuredClone(partial);attack(wrong);await importNotes(page,wrong);
    await expect(page.locator('#action-status')).toHaveAttribute('data-error','true');
    await expect(page.locator('#import-confirm')).not.toBeVisible();
    await expect(page.locator('#normal-notes')).toHaveValue(partial.feedback.records[0]!.notes);
  }
  await page.locator('#normal-notes').fill('Поточна нотатка');
  await importNotes(page,partial);await page.locator('#import-cancel').click();
  await expect(page.locator('#normal-notes')).toHaveValue('Поточна нотатка');
  partial.completed_files=999;partial.feedback_status='RECORDED_UNAPPROVED';
  await importNotes(page,partial);await page.locator('#import-apply').click();
  await expect(page.locator('#progress-text')).toHaveText('1 / 4');
  await expect(page.locator('#normal-notes')).toHaveValue(partial.feedback.records[0]!.notes);
  await expect(page.locator('img')).toHaveCount(0);
  for(const language of ['en','cs']){
    await page.locator('#language').selectOption(language);
    for(const pace of ['normal','slow']){
      await page.locator('#'+pace+'-choice').selectOption('unsure');
      await page.locator('#'+pace+'-listened').check();
    }
  }
  const complete=await exportNotes(page);expect(complete.completed_files).toBe(4);
  expect(complete.feedback_status).toBe('RECORDED_UNAPPROVED');expect(complete.publication_ready).toBe(false);
  expect(complete.p5_milestone).toBe('NOT_READY');expect(complete.p6_authorized).toBe(false);
});

test('filters include missing slots without audio or ratings; empty results and pending progress stay consistent',async({page})=>{
  await page.goto(url);
  await expect(page.locator('#queue button')).toHaveCount(2);
  await page.locator('#view').selectOption('flagged');await expect(page.locator('#queue button')).toHaveCount(2);
  await page.locator('#view').selectOption('missing');await expect(page.locator('#queue button')).toHaveCount(1);
  await expect(page.locator('audio')).toHaveCount(0);await expect(page.locator('.choice')).toHaveCount(0);
  const notes=await exportNotes(page);expect(notes.feedback.records).toHaveLength(4);
  expect(notes.feedback.records.some(r=>r.asset_id.includes('missing'))).toBe(false);
  await page.locator('#view').selectOption('ready');await page.locator('#search').fill('no matching authored phrase');
  await expect(page.locator('#empty')).toBeVisible();await expect(page.locator('#review')).not.toBeVisible();
  await page.locator('#search').fill('Hello');await expect(page.locator('#queue button')).toHaveCount(1);
  await page.locator('#search').fill('');await page.locator('#kind').selectOption('word');
  await expect(page.locator('#empty')).toBeVisible();await page.locator('#kind').selectOption('all');
  await page.locator('#view').selectOption('pending');
  for(const pace of ['normal','slow']){
    await page.locator('#'+pace+'-choice').selectOption('no_issues');await page.locator('#'+pace+'-listened').check();
  }
  await expect(page.locator('#queue button')).toHaveCount(1);
  await page.locator('#next').click();await expect(page.locator('#pair-meta')).toContainText('Чеська');
});

test('mobile keyboard controls and denied storage preserve the export/import workflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});
  });
  await page.goto(url);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#normal-listened').focus();await page.keyboard.press('Space');
  await page.locator('#normal-choice').focus();await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');await expect(page.locator('#normal-issue')).toBeFocused();
  await page.locator('#normal-notes').fill('Нотатка без автозбереження.');
  await expect(page.locator('#storage-status')).toContainText('не дозволяє автозбереження');
  const notes=await exportNotes(page);expect(notes.completed_files).toBe(1);
  await page.reload();await expect(page.locator('#normal-notes')).toHaveValue('');
  await importNotes(page,notes);await page.locator('#import-apply').click();
  await expect(page.locator('#normal-notes')).toHaveValue('Нотатка без автозбереження.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#review').scrollIntoViewIfNeeded();
  await page.screenshot({path:'artifacts/p5/m01-review-mobile.png'});
});
