/// <reference lib="dom" />
import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
for(const language of ['en','cs'] as const)test(`P3 ${language}: login, keyboard answer, reload, correct/reveal/remediation and response-loss recovery`,async({page})=>{
  const runId=process.env[language==='en'?'P3_EN_RUN':'P3_CS_RUN'];expect(runId).toBeTruthy();
  const fixture=JSON.parse(readFileSync(`content/fixtures/p3/${language}-lesson.json`,'utf8'));
  const first=fixture.activities[0];const acceptedId=first.response.answer_policy.accepted_option_ids[0];
  const acceptedLabel=first.presentation.options.find((option:{id:string;label:string})=>option.id===acceptedId).label;
  const wrongLabel=first.presentation.options.find((option:{id:string;label:string})=>option.id!==acceptedId).label;
  await page.goto(`/lesson/${runId}`);
  await page.getByLabel('Email',{exact:true}).fill('p3-learner@example.invalid');await page.getByLabel('Пароль',{exact:true}).fill('Synthetic P3 learner password!');
  await page.getByRole('button',{name:'Увійти та відновити'}).click();
  await expect(page.getByRole('heading',{name:first.presentation.prompt,exact:true})).toBeVisible();
  await page.getByRole('radio',{name:wrongLabel,exact:true}).check();await page.getByRole('button',{name:'Перевірити',exact:true}).click();
  await expect(page.getByRole('button',{name:'Повторити',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Далі',exact:true})).toHaveCount(0);
  await page.reload();await expect(page.getByRole('radio',{name:acceptedLabel,exact:true})).toBeEnabled();
  // Lose one HTTP response after the server commits; IndexedDB retry must use the original UUID.
  let dropped=false;let originalAttempt='';let replayedAttempt='';
  await page.route('**/api/v1/lesson-runs/*/attempts',async route=>{
    const body=route.request().postDataJSON();
    if(!dropped){dropped=true;originalAttempt=body.attempt_id;await route.fetch();await route.abort('failed');}
    else{replayedAttempt=body.attempt_id;await route.continue();}
  });
  await page.getByRole('radio',{name:acceptedLabel,exact:true}).focus();await page.keyboard.press('Space');await page.getByRole('button',{name:'Перевірити',exact:true}).click();
  await expect(page.getByText('З’єднання перервано.',{exact:false})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:fixture.activities[1].presentation.prompt,exact:true})).toBeVisible();
  expect(replayedAttempt).toBe(originalAttempt);await page.unroute('**/api/v1/lesson-runs/*/attempts');
  await page.getByRole('button',{name:'Показати відповідь',exact:true}).click();await expect(page.getByText('Завершено з допомогою',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Далі',exact:true}).click();await expect(page.getByText('Повторення: невирішених вправ — 1.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Завершити з невирішеними вправами',exact:true}).click();await expect(page.getByRole('heading',{name:'Урок завершено',exact:true})).toBeVisible();
  const queueCount=await page.evaluate(async()=>{
    const databases=await indexedDB.databases();let count=0;
    for(const database of databases.filter(value=>value.name?.startsWith('lingvessa-attempts-v1-'))){
      count+=await new Promise<number>((resolve,reject)=>{const request=indexedDB.open(database.name!);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const read=db.transaction('queue').objectStore('queue').get('pending');read.onsuccess=()=>{resolve((read.result??[]).length);db.close();};};});
    }return count;
  });expect(queueCount).toBe(0);
});
