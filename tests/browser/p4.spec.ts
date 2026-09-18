import {test,expect} from '@playwright/test';
for(const language of ['en','cs'] as const){
 test(`P4 ${language}: login, language-scoped Review skip and collection lifecycle`,async({page})=>{
  const profile=language==='en'?process.env.P4_EN_PROFILE!:process.env.P4_CS_PROFILE!;
  await page.goto(`/review?profile=${profile}`);await page.getByLabel('Email',{exact:true}).fill('p4-learner@example.invalid');await page.getByLabel('Пароль',{exact:true}).fill('Synthetic P4 learner password!');await page.getByRole('button',{name:'Увійти',exact:true}).click();
  await expect(page.getByLabel('Мова',{exact:true})).toHaveValue(profile);await page.getByLabel('Режим',{exact:true}).selectOption('all');
  await page.getByRole('button',{name:'Почати повторення',exact:true}).click();await expect(page.getByRole('button',{name:'Пропустити без зарахування',exact:true})).toBeVisible();
  const before=await page.request.get(`/api/v1/mastery/summary?language_profile_id=${profile}&details=true`);expect(before.status()).toBe(200);const beforeBody=await before.json();
  await page.getByRole('button',{name:'Пропустити без зарахування',exact:true}).click();
  await expect(page.getByRole('status').first()).toHaveText('');
  const after=await page.request.get(`/api/v1/mastery/summary?language_profile_id=${profile}&details=true`);expect((await after.json()).projection_checksum).toBe(beforeBody.projection_checksum);
  if(await page.getByRole('button',{name:'Завершити сесію',exact:true}).isVisible())await page.getByRole('button',{name:'Завершити сесію',exact:true}).click();
  const collectionName=`Browser ${language}`;await page.getByLabel('Назва колекції',{exact:true}).fill(collectionName);await page.getByRole('button',{name:'Створити колекцію',exact:true}).click();
  await page.getByRole('button',{name:collectionName,exact:true}).click();await page.getByLabel('Слово або фраза',{exact:true}).fill(language==='en'?'hello again':'dobrý den');
  await page.getByLabel('Переклад',{exact:true}).fill('Привіт');await page.getByRole('button',{name:'Додати запис',exact:true}).click();await expect(page.getByRole('button',{name:'Видалити запис',exact:true})).toBeVisible();
  await page.getByLabel('Нова назва',{exact:true}).fill(`${collectionName} renamed`);await page.getByRole('button',{name:'Перейменувати',exact:true}).click();await expect(page.getByRole('heading',{name:`${collectionName} renamed`,exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Архівувати',exact:true}).click();await expect(page.getByRole('button',{name:'Відновити з архіву',exact:true})).toBeVisible();await page.getByRole('button',{name:'Відновити з архіву',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Видалити колекцію',exact:true}).click();await expect(page.getByRole('heading',{name:`${collectionName} renamed`,exact:true})).toHaveCount(0);
  const other=language==='en'?process.env.P4_CS_PROFILE!:process.env.P4_EN_PROFILE!;await page.getByLabel('Мова',{exact:true}).selectOption(other);await expect(page.getByRole('button',{name:collectionName,exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 });
}
