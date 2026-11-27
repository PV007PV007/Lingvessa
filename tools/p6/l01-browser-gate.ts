import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {cpSync} from 'node:fs';
import {join,resolve} from 'node:path';
import type pg from 'pg';
import type {SpeechRepository} from '../../infra/persistence/speech.js';
import type {AssetStore} from '../../packages/application/src/media.js';
import {createApi} from '../../apps/api/src/app.js';
import {IdentityRepository} from '../../infra/persistence/identity.js';
import {ContentRepository} from '../../infra/persistence/content.js';
import {LessonRepository} from '../../infra/persistence/lessons.js';
import {MediaRepository} from '../../infra/persistence/media.js';
import {MasteryRepository} from '../../infra/persistence/mastery.js';
import {ReviewRepository} from '../../infra/persistence/review.js';
import {CollectionRepository} from '../../infra/persistence/collections.js';
import {ResetRepository} from '../../infra/persistence/resets.js';

export async function l01BrowserGate(pool:pg.Pool,store:AssetStore,speech:SpeechRepository,mode:'--real-l01'|'--svg-text-slice',users:Array<{viewport:string;email:string;password:string;run_id:string}>){
  const app=await createApi({ready:async()=>true,close:async()=>undefined},{identity:new IdentityRepository(pool),content:new ContentRepository(pool,store),lessons:new LessonRepository(pool),media:new MediaRepository(pool,store),speech:{repository:speech},p4:{mastery:new MasteryRepository(pool),review:new ReviewRepository(pool,'test'),collections:new CollectionRepository(pool),resets:new ResetRepository(pool)}});
  await app.listen(0,'127.0.0.1');
  const server=createServer().listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();if(!address||typeof address==='string')throw new Error('Loopback port unavailable');
  const port=address.port;await new Promise<void>(resolve=>server.close(()=>resolve()));
  const root=resolve('apps/web/.next/standalone/apps/web');cpSync('apps/web/.next/static',join(root,'.next/static'),{recursive:true});cpSync('apps/web/public',join(root,'public'),{recursive:true});
  const web=spawn(process.execPath,[join(root,'server.js')],{env:{...process.env,LINGVESSA_ENV:'local',PORT:String(port),HOSTNAME:'127.0.0.1',LINGVESSA_API_ORIGIN:await app.getUrl(),NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});web.stdout.resume();web.stderr.resume();
  try{
    let ready=false;for(let n=0;n<60;n++){try{ready=(await fetch(`http://127.0.0.1:${port}/health/ready`,{signal:AbortSignal.timeout(1000)})).ok;if(ready)break;}catch{/* Startup only. */}await new Promise(resolve=>setTimeout(resolve,250));}
    if(!ready)throw new Error('P6 web fixture failed startup');
    const browser=spawn('pnpm',['exec','playwright','test','--config','tools/p6/playwright.config.ts'],{env:{...process.env,P6_BROWSER_MODE:mode,P6_BROWSER_ORIGIN:`http://127.0.0.1:${port}`,P6_BROWSER_USERS:JSON.stringify(users)},stdio:'inherit'});
    const [code]=await once(browser,'exit');if(code!==0)throw new Error('P6 authored browser gate failed');
  }finally{if(web.exitCode===null&&web.signalCode===null){web.kill('SIGTERM');const timer=setTimeout(()=>web.kill('SIGKILL'),3000);await once(web,'exit');clearTimeout(timer);}await app.close();}
}
