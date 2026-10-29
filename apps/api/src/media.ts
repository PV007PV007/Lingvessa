import {Body,Controller,Get,Post,Header,HttpCode,HttpException,Inject,Param,Req,Res} from '@nestjs/common';
import {z} from 'zod';
import {UUID_PATTERN,ContractError} from '../../../packages/domain/src/identity.js';
import type {IdentityRepository} from '../../../infra/persistence/identity.js';
import type {MediaRepository} from '../../../infra/persistence/media.js';
import {IDENTITY} from './foundation.js';
export const MEDIA=Symbol('P5_MEDIA');
type Request={headers:Record<string,string|undefined>;query:Record<string,string|undefined>};
type Response={status(n:number):Response;setHeader(k:string,v:string):void;send(body:Uint8Array):void};
const uuid=z.string().regex(UUID_PATTERN),version=z.coerce.number().int().positive();
@Controller('lesson-runs/:runId/media')
export class MediaController {
 constructor(@Inject(IDENTITY)private readonly identity:IdentityRepository,@Inject(MEDIA)private readonly media:MediaRepository){}
 private async owner(r:Request){const cookies=(r.headers.cookie??'').split(';').map(s=>s.trim().split('=')).filter(([k])=>k==='__Host-lingvessa_session');return (await this.identity.authenticate(cookies.length===1?cookies[0]?.[1]??'':'')).userId;}
 @Get()
 @Header('Cache-Control','private, no-store')
 async list(@Req()r:Request,@Param('runId')id:string){return this.media.forRun(await this.owner(r),uuid.parse(id),uuid.parse(r.query.item_id));}
 @Post('support')
 @HttpCode(204)
 @Header('Cache-Control','private, no-store')
 async support(@Req()r:Request,@Param('runId')id:string,@Body()body:unknown){
  const cookies=(r.headers.cookie??'').split(';').map(s=>s.trim().split('=')).filter(([k])=>k==='__Host-lingvessa_session');
  const principal=await this.identity.authenticate(cookies.length===1?cookies[0]?.[1]??'':'');
  const csrf=r.headers['x-csrf-token'];if(!csrf)throw new ContractError('FORBIDDEN','CSRF token required');this.identity.checkCsrf(principal,csrf);
  if(!await this.identity.allowLearningAction(principal.userId))throw new ContractError('RATE_LIMITED','Learning action rate limit reached');
  const input=z.object({item_id:uuid,kind:z.literal('transcript')}).strict().parse(body);
  await this.media.recordTranscriptSupport(principal.userId,uuid.parse(id),input.item_id);
 }
 @Get(':assetId/:version')
 @Header('Cache-Control','private, no-store')
 async bytes(@Req()r:Request,@Param('runId')runId:string,@Param('assetId')assetId:string,@Param('version')assetVersion:string,@Res()res:Response){
  const result=await this.media.bytesForRun(await this.owner(r),uuid.parse(runId),uuid.parse(r.query.item_id),uuid.parse(assetId),version.parse(assetVersion));
  const bytes=Buffer.from(result.bytes);res.setHeader('Content-Type',result.metadata.mime);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Accept-Ranges','bytes');res.setHeader('Cache-Control','private, no-store');
  if(result.metadata.mime==='image/svg+xml')res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
  let start=0,end=bytes.length-1;
  if(r.headers.range){const match=/^bytes=(\d*)-(\d*)$/u.exec(r.headers.range);if(!match||(!match[1]&&!match[2]))throw new HttpException('Invalid range',416);
   if(match[1]){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;}else{const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)throw new HttpException('Invalid range',416);start=Math.max(0,bytes.length-suffix);}
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=bytes.length)throw new HttpException('Invalid range',416);
   res.status(206);res.setHeader('Content-Range',`bytes ${start}-${end}/${bytes.length}`);
  }
  res.setHeader('Content-Length',String(end-start+1));res.send(bytes.subarray(start,end+1));
 }
}
