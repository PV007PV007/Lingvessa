import {test} from 'node:test';
import assert from 'node:assert/strict';
import {waitForS3FixtureReady} from '../../tools/p5/fixture-readiness.js';

test('S3 fixture readiness waits for the signed API after startup 503',async()=>{
 const states=[503,503,200];let pauses=0;
 const result=await waitForS3FixtureReady(async()=>states.shift()!,{pause:async()=>{pauses++;}});
 assert.deepEqual(result,{attempts:3,transient503:2,transportNotReady:0});assert.equal(pauses,2);
});
test('S3 fixture connection startup may retry but stops when the API is ready',async()=>{
 const states=[null,200];
 assert.deepEqual(await waitForS3FixtureReady(async()=>states.shift()!,{pause:async()=>undefined}),
  {attempts:2,transient503:0,transportNotReady:1});
});
test('S3 fixture authentication or other HTTP failures are never retried as startup',async()=>{
 for(const status of [401,403,404,429,500]){
  let calls=0;
  await assert.rejects(waitForS3FixtureReady(async()=>{calls++;return status;},{pause:async()=>assert.fail('No retry')}),
   new RegExp(`HTTP ${status}`));assert.equal(calls,1);
 }
});
test('S3 fixture readiness has a hard bounded failure path',async()=>{
 let calls=0,pauses=0;
 await assert.rejects(waitForS3FixtureReady(async()=>{calls++;return 503;},{maxAttempts:3,pause:async()=>{pauses++;}}),
  /timeout after 3 probes/);
 assert.equal(calls,3);assert.equal(pauses,2);
});
