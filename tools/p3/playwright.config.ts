import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({testDir:'../../tests/browser',workers:1,retries:0,timeout:45000,
  outputDir:'../../artifacts/p3/browser',reporter:[['list'],['json',{outputFile:fileURLToPath(new URL('../../artifacts/p3/browser-results.json',import.meta.url))}]],
  use:{baseURL:process.env.P3_BROWSER_ORIGIN,headless:true,viewport:{width:390,height:844},trace:'retain-on-failure',screenshot:'only-on-failure'}});
