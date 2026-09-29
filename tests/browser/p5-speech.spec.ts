/// <reference lib="dom" />
import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';

type CaptureProbe={calls:number;tracks:MediaStreamTrack[];deny:boolean;absent:boolean};
declare global {interface Window {p5Capture:CaptureProbe}}
async function openSpeech(page:Page,language:'en'|'cs'){
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  const actual=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  window.p5Capture={calls:0,tracks:[],deny:false,absent:false};
  navigator.mediaDevices.getUserMedia=async constraints=>{
   const probe=window.p5Capture;probe.calls++;
   if(probe.deny)throw new DOMException('Synthetic permission refusal','NotAllowedError');
   if(probe.absent)throw new DOMException('Synthetic absent microphone','NotFoundError');
   const stream=await actual(constraints);probe.tracks.push(...stream.getTracks());return stream;
  };
 });
 const run=process.env[language==='en'?'P5_EN_RUN':'P5_CS_RUN'];expect(run).toBeTruthy();
 await page.goto(`/lesson/${run}`);await page.getByLabel('Email',{exact:true}).fill('p5-learner@example.invalid');
 await page.getByLabel('Пароль',{exact:true}).fill('Synthetic P5 learner password!');await page.getByRole('button',{name:'Увійти та відновити'}).click();
 await expect(page.getByRole('button',{name:'Увімкнути мікрофон',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>window.p5Capture.calls)).toBe(0);
 return errors;
}
async function stopRecording(page:Page){
 await expect(page.getByText('Мікрофон увімкнений',{exact:true})).toBeVisible();
 // Wait for a real MediaRecorder data chunk, not a mocked upload.
 await page.waitForTimeout(350);await page.getByRole('button',{name:'Завершити запис',exact:true}).click();
}
async function tracksStopped(page:Page){expect(await page.evaluate(()=>window.p5Capture.tracks.every(track=>track.readyState==='ended'))).toBe(true);}

test('P5 English real microphone lifecycle: lost responses, same job replay, match/mismatch Retry, Continue and Auto-advance',async({page})=>{
 const errors=await openSpeech(page,'en');await page.emulateMedia({reducedMotion:'reduce'});
 const creates:Array<{key:string|null;attempt:string}>=[];let dropCreate=true,dropUpload=true,puts=0;
 await page.route('**/api/v1/speech/jobs',async route=>{
  if(route.request().method()!=='POST'){await route.continue();return;}
  const body=route.request().postDataJSON() as {attempt_id:string};creates.push({key:route.request().headers()['idempotency-key']??null,attempt:body.attempt_id});
  if(dropCreate){dropCreate=false;await route.fetch();await route.abort('connectionfailed');}else await route.continue();
 });
 await page.route('**/api/v1/speech/jobs/*/audio?*',async route=>{
  puts++;if(dropUpload){dropUpload=false;await route.fetch();await route.abort('connectionfailed');}else await route.continue();
 });
 await page.getByRole('button',{name:'Увімкнути мікрофон',exact:true}).click();
 await expect(page.getByText('Не вдалося почати або надіслати запис. Повторіть з’єднання.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Відновити з’єднання',exact:true}).click();await expect(page.getByRole('button',{name:'Увімкнути мікрофон',exact:true})).toBeEnabled();
 expect(creates).toHaveLength(2);expect(creates[0]).toEqual(creates[1]);
 await page.getByRole('button',{name:'Увімкнути мікрофон',exact:true}).click();
 await expect(page.getByRole('button',{name:'Завершити запис',exact:true})).toBeVisible();
 expect(await page.locator('.speech-microphone.recording').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
 await stopRecording(page);await expect(page.getByText('З’єднання недоступне. Повторіть надсилання; номер спроби залишиться тим самим.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Відновити з’єднання',exact:true}).click();await expect(page.getByText('Правильно',{exact:true})).toBeVisible();expect(puts).toBe(1);await tracksStopped(page);
 await page.getByRole('button',{name:'Повторити запис',exact:true}).click();await stopRecording(page);await expect(page.getByText('Спробуйте ще раз',{exact:true})).toBeVisible();
 expect(creates).toHaveLength(3);expect(creates[2]!.attempt).not.toBe(creates[0]!.attempt);await tracksStopped(page);
 await page.getByRole('button',{name:'Далі',exact:true}).click();await expect(page.getByText('English · 2 / 2',{exact:true})).toBeVisible();
 await page.getByLabel('Автоматично переходити після відповіді').check();await page.getByRole('button',{name:'Увімкнути мікрофон',exact:true}).click();await stopRecording(page);
 await expect(page.getByText('Правильно',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Урок завершено',exact:true})).toBeVisible();await tracksStopped(page);
 expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('P5 Czech shared speech UI: denied/absent, low confidence, provider failure, cancellation and non-blocking advancement',async({page})=>{
 const errors=await openSpeech(page,'cs');await page.evaluate(()=>{window.p5Capture.deny=true;});
 await page.getByRole('button',{name:'Увімкнути мікрофон',exact:true}).click();await expect(page.getByText('Оцінювання недоступне',{exact:true})).toBeVisible();
 await page.evaluate(()=>{window.p5Capture.deny=false;window.p5Capture.absent=true;});await page.getByRole('button',{name:'Повторити запис',exact:true}).click();await expect(page.getByText('Оцінювання недоступне',{exact:true})).toBeVisible();
 await page.evaluate(()=>{window.p5Capture.absent=false;});await page.getByRole('button',{name:'Повторити запис',exact:true}).click();await stopRecording(page);await expect(page.getByText('Оцінювання недоступне',{exact:true})).toBeVisible();await tracksStopped(page);
 await page.getByRole('button',{name:'Повторити запис',exact:true}).click();await stopRecording(page);await expect(page.getByText('Оцінювання недоступне',{exact:true})).toBeVisible({timeout:15000});await tracksStopped(page);
 await page.getByRole('button',{name:'Далі',exact:true}).click();await expect(page.getByText('Čeština · 2 / 2',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Увімкнути мікрофон',exact:true}).click();await expect(page.getByText('Мікрофон увімкнений',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Скасувати запис',exact:true}).click();await expect(page.getByText('Оцінювання недоступне',{exact:true})).toBeVisible();await tracksStopped(page);
 await page.getByLabel('Автоматично переходити після відповіді').check();await expect(page.getByRole('heading',{name:'Урок завершено',exact:true})).toBeVisible();
 expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
