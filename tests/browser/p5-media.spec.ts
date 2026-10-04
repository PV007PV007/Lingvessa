/// <reference lib="dom" />
import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
for(const language of ['en','cs'] as const)test(`P5 ${language} audio: explicit play, reviewed slow pin, speaker clock and failure text`,async({page})=>{
 const run=process.env[language==='en'?'P5_EN_RUN':'P5_CS_RUN'];expect(run).toBeTruthy();
 await page.goto(`/lesson/${run}`);await page.getByLabel('Email',{exact:true}).fill('p5-learner@example.invalid');await page.getByLabel('Пароль',{exact:true}).fill('Synthetic P5 learner password!');await page.getByRole('button',{name:'Увійти та відновити'}).click();
 const audio=page.locator('audio');await expect(audio).toHaveCount(1);expect(await audio.evaluate(e=>(e as HTMLAudioElement).paused)).toBe(true);
 const avatars=page.locator('.dialogue-speakers figure');await expect(avatars).toHaveCount(2);
 for(const img of await avatars.locator('img').all())await expect.poll(()=>img.evaluate(e=>(e as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 await expect(avatars.filter({hasText:'A'})).toHaveAttribute('aria-current','true');
 await page.getByRole('button',{name:'Відтворити',exact:true}).click();await expect.poll(()=>audio.evaluate(e=>(e as HTMLAudioElement).paused)).toBe(false);
 const normal=await audio.getAttribute('src');await page.getByRole('button',{name:'Пауза',exact:true}).click();expect(await audio.evaluate(e=>(e as HTMLAudioElement).paused)).toBe(true);
 await page.getByRole('button',{name:'Повільно',exact:true}).click();await expect.poll(()=>audio.getAttribute('src')).not.toBe(normal);await expect.poll(()=>audio.evaluate(e=>(e as HTMLAudioElement).paused)).toBe(false);
 expect(await audio.evaluate(e=>(e as HTMLAudioElement).playbackRate)).toBe(1);await expect(page.getByRole('button',{name:'Повільно',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Пауза',exact:true}).click();await page.getByText('Текст запису',{exact:true}).click();
 await audio.evaluate(e=>{const a=e as HTMLAudioElement;a.currentTime=7;a.dispatchEvent(new Event('timeupdate'));});await expect(page.locator('li[aria-current="true"]')).toContainText('B:');
 await expect(page.locator('.dialogue-speakers figure[aria-current="true"]')).toHaveText('B');
 await page.getByRole('button',{name:'Ще раз',exact:true}).click();await expect.poll(()=>audio.evaluate(e=>(e as HTMLAudioElement).currentTime)).toBeLessThan(2);
 await page.getByRole('button',{name:'Відтворити',exact:true}).click();await expect(audio).toHaveAttribute('src',normal!);
 await audio.evaluate(e=>e.dispatchEvent(new Event('error')));await expect(page.getByText('Запис тимчасово недоступний. Текст залишається доступним.',{exact:true})).toBeVisible();
 await expect(page.getByRole('radio').first()).toBeEnabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.reload();await expect(audio).toHaveCount(1);expect(await audio.evaluate(e=>(e as HTMLAudioElement).paused)).toBe(true);
 // Published normal remains playable if the client uses pitch-preserving slow playback instead of a slow asset.
 await page.route('**/media?item_id=*',async route=>{const response=await route.fetch();const assets=await response.json() as Array<{speed:string}>;await route.fulfill({response,json:assets.filter(a=>a.speed!=='slow')});});
 await page.reload();await expect(audio).toHaveCount(1);await page.getByRole('button',{name:'Повільно',exact:true}).click();
 await expect.poll(()=>audio.evaluate(e=>(e as HTMLAudioElement).playbackRate)).toBe(0.75);expect(await audio.evaluate(e=>(e as HTMLAudioElement).preservesPitch)).toBe(true);
});

for(const country of ['gb','ua','cz','pl','de','sk','es'])test(`P5 flag ${country}: static normalization preserves source geometry`,async({page})=>{
 const files=['source','normalized'].map(kind=>readFileSync(`assets/specs/p5/flags/${kind}/${country}.svg`,'utf8'));
 const viewBox=(xml:string)=>/viewBox="([^"]+)"/u.exec(xml)![1]!.split(/\s+/u).map(Number);
 expect(viewBox(files[1]!)).toEqual(viewBox(files[0]!));
 await page.goto('about:blank');
 const comparison=await page.evaluate(async values=>{
  const images=await Promise.all(values.map(async value=>{const img=new Image();img.src=`data:image/svg+xml;base64,${value}`;await img.decode();return img;}));
  const pixels=images.map(img=>{const c=document.createElement('canvas');c.width=300;c.height=150;const ctx=c.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,300,150);ctx.drawImage(img,0,0,300,150);return ctx.getImageData(0,0,300,150).data;});
  let changed=0;for(let i=0;i<pixels[0]!.length;i+=4){if(Math.max(...[0,1,2].map(k=>Math.abs(pixels[0]![i+k]!-pixels[1]![i+k]!)))>32)changed++;}
  return changed/(300*150);
 },files.map(s=>Buffer.from(s).toString('base64')));
 // Edge antialiasing may differ; lost/moved flag geometry cannot pass this bound.
 expect(comparison).toBeLessThan(0.015);
});
