import {setTimeout as delay} from 'node:timers/promises';

// A test-server startup gate only. Object operations/outage assertions never use this retry.
// A successful process health probe is insufficient while the S3 storage API is initializing.
export async function waitForS3FixtureReady(
 probe:()=>Promise<number|null>,
 options:{maxAttempts?:number;pause?:()=>Promise<void>}={},
){
 const maxAttempts=options.maxAttempts??150,pause=options.pause??(()=>delay(100));
 if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>150)throw new Error('Invalid fixture readiness bound');
 let transient503=0,transportNotReady=0;
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  const status=await probe();
  if(status===200)return {attempts:attempt,transient503,transportNotReady};
  if(status===503)transient503++;
  else if(status===null)transportNotReady++;
  else throw new Error(`S3 fixture readiness rejected with HTTP ${status}`);
  if(attempt<maxAttempts)await pause();
 }
 throw new Error(`S3 fixture API readiness timeout after ${maxAttempts} probes`);
}
