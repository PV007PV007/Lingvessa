/// <reference lib="dom" />
import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {l01TestSlice} from '../support/p6-authored-slice.js';
test('authored L01 SVG/text: real delivery, wrong/reveal, reload, native remediation and result',async({page,baseURL},info)=>{
  const users=JSON.parse(process.env.P6_BROWSER_USERS!) as Array<{viewport:string;email:string;password:string;run_id:string}>;
  const user=users.find(u=>u.viewport===info.project.name)!;
  const origin=new URL(baseURL!).origin;
  // Login through the actual Next proxy. Credentials never enter reports, screenshots or traces.
  expect((await page.request.post('/api/v1/auth/login',{headers:{origin,'x-lingvessa-client':'web'},data:{email:user.email,password:user.password}})).status()).toBe(200);
  const slice=l01TestSlice(JSON.parse(readFileSync('content/english/m01/l01.json','utf8')));
  await page.goto('/lesson/'+user.run_id);
  for(const [index,a] of slice.activities.entries()){
    await expect(page.getByText(`English · ${index+1} / ${slice.activities.length}`,{exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:a.presentation.prompt,exact:true})).toBeVisible();
    await page.getByLabel('Автоматично переходити після відповіді').uncheck();
    if(a.presentation.media_refs.length){
      const images=page.locator('.lesson-media img');await expect(images).toHaveCount(a.presentation.media_refs.length);
      for(const ref of a.presentation.media_refs){const src=`/api/v1/lesson-runs/${user.run_id}/media/${ref.asset_id}/${ref.asset_version}?item_id=${a.id}`;
        const img=page.locator(`.lesson-media img[src="${src}"]`);await expect(img).toBeVisible();
        await expect.poll(()=>img.evaluate(el=>(el as HTMLImageElement).complete&&(el as HTMLImageElement).naturalWidth>0)).toBe(true);
      }
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(index===0){
      await page.getByRole('radio',{name:'Goodbye.',exact:true}).check();await page.getByRole('button',{name:'Перевірити',exact:true}).click();
      await expect(page.getByRole('button',{name:'Повторити',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Далі',exact:true})).toHaveCount(0);
      await page.getByRole('button',{name:'Показати відповідь',exact:true}).click();await expect(page.getByText('Завершено з допомогою',{exact:true})).toBeVisible();
    }else{
      if(index===1){await page.reload();await expect(page.getByText('English · 2 / 9',{exact:true})).toBeVisible();}
      for(let n=1;n<(a.presentation.steps?.length??0);n++)await page.getByRole('button',{name:'Наступний приклад',exact:true}).click();
      const policy=a.response.answer_policy;
      if(policy.mode==='single')await page.getByRole('radio',{name:a.presentation.options!.find(o=>o.id===policy.accepted_option_ids![0])!.label,exact:true}).check();
      if(policy.mode==='text')await page.getByRole('textbox',{name:'Ваша відповідь',exact:true}).fill(a.stable_code.endsWith('RETRIEVE-BYE')?'Bye':'Could you repeat that please?');
      await page.getByRole('button',{name:policy.mode==='exposure'?'Продовжити':'Перевірити',exact:true}).click();
    }
    await page.getByRole('button',{name:'Далі',exact:true}).click();
  }
  await expect(page.getByText('Повторення: невирішених вправ — 1.',{exact:true})).toBeVisible();
  await page.getByRole('radio',{name:'Good morning.',exact:true}).check();await page.getByRole('button',{name:'Перевірити',exact:true}).click();await page.getByRole('button',{name:'Далі',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Урок завершено',exact:true})).toBeVisible();
  await expect(page.getByText('Словниковий запас:',{exact:false})).toBeVisible();
  await expect(page.getByRole('link',{name:'До повторення та колекцій',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'Урок завершено',exact:true})).toBeVisible();
});
