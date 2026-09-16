import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { cpSync } from 'node:fs';
import { resolve, join } from 'node:path';

export async function browserGate(apiOrigin: string, enRun: string, csRun: string): Promise<void> {
  const server=createServer().listen(0,'127.0.0.1');await once(server,'listening');const port=(server.address() as AddressInfo).port;
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  const appRoot=resolve('apps/web/.next/standalone/apps/web');
  cpSync('apps/web/.next/static',join(appRoot,'.next/static'),{recursive:true});cpSync('apps/web/public',join(appRoot,'public'),{recursive:true});
  const web=spawn(process.execPath,[join(appRoot,'server.js')],{env:{...process.env,LINGVESSA_ENV:'local',PORT:String(port),HOSTNAME:'127.0.0.1',LINGVESSA_API_ORIGIN:apiOrigin,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
  web.stdout.resume();web.stderr.resume();
  try{
    let ready=false;
    for(let n=0;n<40;n++){
      try{ready=(await fetch(`http://127.0.0.1:${port}/health/ready`,{signal:AbortSignal.timeout(1000)})).ok;if(ready)break;}catch{/* Startup only. */}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    if(!ready)throw new Error('P3 browser web fixture failed startup');
    const browser=spawn('pnpm',['exec','playwright','test','--config','tools/p3/playwright.config.ts'],{env:{...process.env,P3_BROWSER_ORIGIN:`http://127.0.0.1:${port}`,P3_EN_RUN:enRun,P3_CS_RUN:csRun},stdio:'inherit'});
    const [code]=await once(browser,'exit');if(code!==0)throw new Error(`P3 browser acceptance failed (${String(code)})`);
  }finally{
    web.kill('SIGTERM');const timer=setTimeout(()=>web.kill('SIGKILL'),3000);await once(web,'exit');clearTimeout(timer);
  }
}
