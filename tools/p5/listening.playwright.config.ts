import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  testDir:'../../tests/browser', testMatch:'p5-listening-review.spec.ts', workers:1, retries:0, timeout:60000,
  outputDir:'../../artifacts/p5/listening-browser',
  reporter:[['list'],['json',{outputFile:fileURLToPath(new URL('../../artifacts/p5/listening-browser-results.json',import.meta.url))}]],
  use:{headless:true,viewport:{width:1280,height:900},trace:'retain-on-failure',screenshot:'only-on-failure'},
});
