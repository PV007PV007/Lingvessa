import {Body,Controller,Get,Header,HttpCode,Inject,Param,Post,Put,Req} from '@nestjs/common';
import {z} from 'zod';
import {UUID_PATTERN,ContractError} from '../../../packages/domain/src/identity.js';
import type {IdentityRepository} from '../../../infra/persistence/identity.js';
import type {SpeechRepository} from '../../../infra/persistence/speech.js';
import {verifySpeechCallback} from '../../../packages/provider-adapters/speech/callback.js';
import {IDENTITY} from './foundation.js';
export const SPEECH=Symbol('P5_SPEECH');
export type SpeechServices={repository:SpeechRepository;callback?:{secret:Uint8Array;origin:string}};
type Request={headers:Record<string,string|undefined>;query:Record<string,string|undefined>;rawBody?:Buffer};
const uuid=z.string().regex(UUID_PATTERN);
function token(request:Request){const found=(request.headers.cookie??'').split(';').map(p=>p.trim().split('=')).filter(([name])=>name==='__Host-lingvessa_session');return found.length===1?found[0]?.[1]??'':'';}
@Controller('speech/jobs')
export class SpeechController {
 constructor(@Inject(IDENTITY)private readonly identity:IdentityRepository,@Inject(SPEECH)private readonly services:SpeechServices){}
 private async principal(r:Request,mutation=false){const p=await this.identity.authenticate(token(r));if(mutation){this.identity.checkCsrf(p,r.headers['x-csrf-token']??'');if(!await this.identity.allowLearningAction(p.userId))throw new ContractError('RATE_LIMITED','Speech action limit reached');}return p;}
 @Post() @Header('Cache-Control','private, no-store')
 async create(@Req() r:Request,@Body() body:unknown){const p=await this.principal(r,true);return this.services.repository.create(p.userId,uuid.parse(r.headers['idempotency-key']),body);}
 @Get() @Header('Cache-Control','private, no-store')
 async latest(@Req() r:Request){const p=await this.principal(r);return {job:await this.services.repository.latest(p.userId,uuid.parse(r.query.lesson_run_id),uuid.parse(r.query.item_id))};}
 @Get(':id') @Header('Cache-Control','private, no-store')
 async get(@Req() r:Request,@Param('id') id:string){const p=await this.principal(r);return this.services.repository.get(p.userId,uuid.parse(id));}
 @Put(':id/audio') @HttpCode(200) @Header('Cache-Control','private, no-store')
 async upload(@Req() r:Request,@Param('id') id:string,@Body() body:unknown){const p=await this.principal(r,true);if(!Buffer.isBuffer(body))throw new ContractError('INVALID_INPUT','Binary audio body required');return this.services.repository.upload(p.userId,uuid.parse(id),r.query.token??'',r.headers['content-type']??'',body);}
 @Post(':id/submit') @HttpCode(200) @Header('Cache-Control','private, no-store')
 async submit(@Req() r:Request,@Param('id') id:string,@Body() body:unknown){const p=await this.principal(r,true);return this.services.repository.submit(p.userId,uuid.parse(id),body??{});}
 @Post(':id/cancel') @HttpCode(200) @Header('Cache-Control','private, no-store')
 async cancel(@Req() r:Request,@Param('id') id:string,@Body() body:unknown){const p=await this.principal(r,true);z.object({}).strict().parse(body??{});return this.services.repository.cancel(p.userId,uuid.parse(id));}
}
@Controller('lesson-runs')
export class SpeechNextController {
 constructor(@Inject(IDENTITY)private readonly identity:IdentityRepository,@Inject(SPEECH)private readonly services:SpeechServices){}
 @Post(':id/next') @HttpCode(200) @Header('Cache-Control','private, no-store')
 async next(@Req() r:Request,@Param('id') id:string,@Body() body:unknown){const p=await this.identity.authenticate(token(r));this.identity.checkCsrf(p,r.headers['x-csrf-token']??'');if(!await this.identity.allowLearningAction(p.userId))throw new ContractError('RATE_LIMITED','Learning action limit reached');const input=z.object({job_id:uuid}).strict().parse(body);return this.services.repository.next(p.userId,uuid.parse(id),input.job_id);}
}
@Controller('internal/speech')
export class SpeechCallbackController {
 constructor(@Inject(SPEECH)private readonly services:SpeechServices){}
 @Post('callback') @HttpCode(200) @Header('Cache-Control','no-store')
 async callback(@Req() r:Request){const c=this.services.callback;if(!c||!r.rawBody)throw new ContractError('FORBIDDEN','Speech callback disabled');
  const input=verifySpeechCallback(c.secret,c.origin,r.headers['x-speech-origin']??'',r.headers['x-speech-timestamp']??'',r.headers['x-speech-signature']??'',r.rawBody.toString('utf8'));
  return this.services.repository.callback(input);
 }
}
