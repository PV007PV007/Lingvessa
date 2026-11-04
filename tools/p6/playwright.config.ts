import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
export default defineConfig({testDir:'../../tests/browser',testMatch:'p6-l01.spec.ts',workers:1,retries:0,timeout:90000,
  reporter:[['list'],['json',{outputFile:fileURLToPath(new URL('../../artifacts/p6/l01-browser.json',import.meta.url))}]],
  projects:[{name:'mobile',use:{viewport:{width:390,height:844}}},{name:'desktop',use:{viewport:{width:1280,height:800}}}],
  use:{baseURL:process.env.P6_BROWSER_ORIGIN,headless:true,trace:'off',screenshot:'off'}});
