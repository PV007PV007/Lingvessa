import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({testDir:'../../tests/browser',testMatch:'p4.spec.ts',workers:1,retries:0,timeout:45000,
  outputDir:'../../artifacts/p4/browser',reporter:[['list'],['json',{outputFile:fileURLToPath(new URL('../../artifacts/p4/browser-results.json',import.meta.url))}]],
  use:{baseURL:process.env.P4_BROWSER_ORIGIN,headless:true,viewport:{width:390,height:844},trace:'retain-on-failure',screenshot:'only-on-failure'}});
