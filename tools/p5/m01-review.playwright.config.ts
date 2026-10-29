import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  testDir:'../../tests/browser', testMatch:'p5-m01-review.spec.ts', workers:1, retries:0, timeout:60000,
  outputDir:'../../artifacts/p5/m01-review-browser',
  reporter:[['list'],['json',{outputFile:fileURLToPath(new URL('../../artifacts/p5/m01-review-browser-results.json',import.meta.url))}]],
  use:{headless:true,viewport:{width:1440,height:1080},trace:'retain-on-failure',screenshot:'only-on-failure'},
});
