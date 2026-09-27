/// <reference lib="dom" />
import {test,expect} from '@playwright/test';
for(const language of ['en','cs'] as const)test(`P5 ${language} audio: explicit play, reviewed slow pin, speaker clock and failure text`,async({page})=>{
 const run=process.env[language==='en'?'P5_EN_RUN':'P5_CS_RUN'];expect(run).toBeTruthy();
 await page.goto(`/lesson/${run}`);await page.getByLabel('Email',{exact:true}).fill('p5-learner@example.invalid');await page.getByLabel('Пароль',{exact:true}).fill('Synthetic P5 learner password!');await page.getByRole('button',{name:'Увійти та відновити'}).click();
 const audio=page.locator('audio');await expect(audio).toHaveCount(1);expect(await audio.evaluate(e=>(e as HTMLAudioElement).paused)).toBe(true);
 await page.getByRole('button',{name:'Відтворити',exact:true}).click();await expect.poll(()=>audio.evaluate(e=>(e as HTMLAudioElement).paused)).toBe(false);
 const normal=await audio.getAttribute('src');await page.getByRole('button',{name:'Пауза',exact:true}).click();expect(await audio.evaluate(e=>(e as HTMLAudioElement).paused)).toBe(true);
 await page.getByRole('button',{name:'Повільно',exact:true}).click();await expect.poll(()=>audio.getAttribute('src')).not.toBe(normal);await expect.poll(()=>audio.evaluate(e=>(e as HTMLAudioElement).paused)).toBe(false);
 expect(await audio.evaluate(e=>(e as HTMLAudioElement).playbackRate)).toBe(1);await expect(page.getByRole('button',{name:'Повільно',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Пауза',exact:true}).click();await page.getByText('Текст запису',{exact:true}).click();
 await audio.evaluate(e=>{const a=e as HTMLAudioElement;a.currentTime=7;a.dispatchEvent(new Event('timeupdate'));});await expect(page.locator('li[aria-current="true"]')).toContainText('B:');
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
