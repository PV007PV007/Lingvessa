import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
 page.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/'))console.log('P4_BROWSER_HTTP',path,r.status());});
 page.on('pageerror',e=>console.log('P4_BROWSER_RUNTIME',e.message.slice(0,200)));
});
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus)console.log('P4_BROWSER_VISIBLE',await page.locator('body').innerText().catch(()=>'<unavailable>'));});
for(const language of ['en','cs'] as const){
 test(`P4 ${language}: login, language-scoped Review skip and collection lifecycle`,async({page})=>{
  const profile=language==='en'?process.env.P4_EN_PROFILE!:process.env.P4_CS_PROFILE!;
  await page.goto(`/review?profile=${profile}`);await page.getByLabel('Email',{exact:true}).fill('p4-learner@example.invalid');await page.getByLabel('Пароль',{exact:true}).fill('Synthetic P4 learner password!');await page.getByRole('button',{name:'Увійти',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Мова',exact:true})).toHaveValue(profile);await page.getByRole('combobox',{name:'Режим',exact:true}).selectOption('all');
  await page.getByRole('button',{name:'Почати повторення',exact:true}).click();await expect(page.getByRole('button',{name:'Пропустити без зарахування',exact:true})).toBeVisible();
  // Use the real browser's Secure-cookie handling on loopback, just like the UI.
  // APIRequestContext over plain HTTP does not send this Secure session cookie.
  const summary=()=>page.evaluate(async profile=>{const r=await fetch(`/api/v1/mastery/summary?language_profile_id=${profile}&details=true`,{credentials:'include'});return {status:r.status,body:await r.json()};},profile);
  const before=await summary();expect(before.status).toBe(200);const beforeBody=before.body;
  const skipped=page.waitForResponse(r=>r.url().endsWith('/skip')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Пропустити без зарахування',exact:true}).click();expect((await skipped).status()).toBe(200);
  await expect(page.getByRole('status').first()).toHaveText('');
  const after=await summary();expect(after.status).toBe(200);expect(after.body.projection_checksum).toBe(beforeBody.projection_checksum);
  if(await page.getByRole('button',{name:'Завершити сесію',exact:true}).isVisible())await page.getByRole('button',{name:'Завершити сесію',exact:true}).click();
  const collectionName=`Browser ${language}`;await page.getByLabel('Назва колекції',{exact:true}).fill(collectionName);await page.getByRole('button',{name:'Створити колекцію',exact:true}).click();
  await page.getByRole('button',{name:collectionName,exact:true}).click();await page.getByLabel('Слово або фраза',{exact:true}).fill(language==='en'?'hello again':'dobrý den');
  await page.getByLabel('Переклад',{exact:true}).fill('Привіт');await page.getByRole('button',{name:'Додати запис',exact:true}).click();await expect(page.getByRole('button',{name:'Видалити запис',exact:true})).toBeVisible();
  await page.getByLabel('Нова назва',{exact:true}).fill(`${collectionName} renamed`);await page.getByRole('button',{name:'Перейменувати',exact:true}).click();await expect(page.getByRole('heading',{name:`${collectionName} renamed`,exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Архівувати',exact:true}).click();await expect(page.getByRole('button',{name:'Відновити з архіву',exact:true})).toBeVisible();await page.getByRole('button',{name:'Відновити з архіву',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Видалити колекцію',exact:true}).click();await expect(page.getByRole('heading',{name:`${collectionName} renamed`,exact:true})).toHaveCount(0);
  const other=language==='en'?process.env.P4_CS_PROFILE!:process.env.P4_EN_PROFILE!;await page.getByRole('combobox',{name:'Мова',exact:true}).selectOption(other);await expect(page.getByRole('button',{name:collectionName,exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 });
}
