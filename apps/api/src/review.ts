import {Body,Controller,Delete,Get,Header,HttpCode,Inject,Param,Patch,Post,Put,Req} from '@nestjs/common';
import {z} from 'zod';
import type {IdentityRepository} from '../../../infra/persistence/identity.js';
import type {MasteryRepository} from '../../../infra/persistence/mastery.js';
import type {ReviewRepository} from '../../../infra/persistence/review.js';
import type {CollectionRepository} from '../../../infra/persistence/collections.js';
import type {ResetRepository} from '../../../infra/persistence/resets.js';
import {ContractError,UUID_PATTERN} from '../../../packages/domain/src/identity.js';
import {IDENTITY} from './foundation.js';
export const P4=Symbol('P4_MASTERY_REVIEW');
export type P4Services={mastery:MasteryRepository;review:ReviewRepository;collections:CollectionRepository;resets:ResetRepository};
type Request={headers:Record<string,string|undefined>;query:Record<string,string|undefined>};
const uuid=z.string().regex(UUID_PATTERN);
@Controller()
export class ReviewController {
  constructor(@Inject(IDENTITY)private readonly identity:IdentityRepository,@Inject(P4)private readonly p4:P4Services){}
  @Get('mastery/summary') @Header('Cache-Control','private, no-store')
  async summary(@Req()r:Request){const p=await this.principal(r);return this.p4.mastery.summary(p.userId,uuid.parse(r.query.language_profile_id),r.query.details==='true');}
  @Get('lesson-runs/:id/summary') @Header('Cache-Control','private, no-store')
  async runSummary(@Req()r:Request,@Param('id')id:string){const p=await this.principal(r);return this.p4.mastery.runSummary(p.userId,uuid.parse(id));}
  @Get('mistakes') @Header('Cache-Control','private, no-store')
  async mistakes(@Req()r:Request){const p=await this.principal(r);return this.p4.mastery.mistakes(p.userId,uuid.parse(r.query.language_profile_id));}
  @Post('review-sessions') @Header('Cache-Control','private, no-store')
  async start(@Req()r:Request,@Body()body:unknown){const p=await this.principal(r,true);return this.p4.review.start(p.userId,body);}
  @Get('review-sessions/:id') @Header('Cache-Control','private, no-store')
  async get(@Req()r:Request,@Param('id')id:string){const p=await this.principal(r);return this.p4.review.get(p.userId,uuid.parse(id));}
  @Post('review-sessions/:id/skip') @HttpCode(200) @Header('Cache-Control','private, no-store')
  async skip(@Req()r:Request,@Param('id')id:string,@Body()body:unknown){const p=await this.principal(r,true);return this.p4.review.skip(p.userId,uuid.parse(id),body);}
  @Post('review-sessions/:id/cancel') @HttpCode(200) @Header('Cache-Control','private, no-store')
  async cancel(@Req()r:Request,@Param('id')id:string){const p=await this.principal(r,true);return this.p4.review.cancel(p.userId,uuid.parse(id));}
  @Post('collections') @Header('Cache-Control','private, no-store')
  async createCollection(@Req()r:Request,@Body()body:unknown){const p=await this.principal(r,true);return this.p4.collections.create(p.userId,body);}
  @Get('collections') @Header('Cache-Control','private, no-store')
  async collections(@Req()r:Request){const p=await this.principal(r);return this.p4.collections.list(p.userId,uuid.parse(r.query.language_profile_id));}
  @Get('collections/:id') @Header('Cache-Control','private, no-store')
  async collection(@Req()r:Request,@Param('id')id:string){const p=await this.principal(r);return this.p4.collections.get(p.userId,uuid.parse(id));}
  @Patch('collections/:id') @Header('Cache-Control','private, no-store')
  async updateCollection(@Req()r:Request,@Param('id')id:string,@Body()body:unknown){const p=await this.principal(r,true);return this.p4.collections.update(p.userId,uuid.parse(id),body);}
  @Delete('collections/:id') @Header('Cache-Control','private, no-store')
  async deleteCollection(@Req()r:Request,@Param('id')id:string){const p=await this.principal(r,true);return this.p4.collections.remove(p.userId,uuid.parse(id));}
  @Post('collections/:id/entries') @Header('Cache-Control','private, no-store')
  async entry(@Req()r:Request,@Param('id')id:string,@Body()body:unknown){const p=await this.principal(r,true);return this.p4.collections.putEntry(p.userId,uuid.parse(id),body);}
  @Put('collections/:id/entries/:entry') @Header('Cache-Control','private, no-store')
  async updateEntry(@Req()r:Request,@Param('id')id:string,@Param('entry')entry:string,@Body()body:unknown){const p=await this.principal(r,true);return this.p4.collections.putEntry(p.userId,uuid.parse(id),body,uuid.parse(entry));}
  @Delete('collections/:id/entries/:entry') @Header('Cache-Control','private, no-store')
  async deleteEntry(@Req()r:Request,@Param('id')id:string,@Param('entry')entry:string){const p=await this.principal(r,true);return this.p4.collections.removeEntry(p.userId,uuid.parse(id),uuid.parse(entry));}
  @Post('learning-resets') @Header('Cache-Control','private, no-store')
  async reset(@Req()r:Request,@Body()body:unknown){const p=await this.principal(r,true);return this.p4.resets.reset(p.userId,body);}
  private async principal(r:Request,mutation=false){
    const tokens=(r.headers.cookie??'').split(';').map(c=>c.trim().split('=')).filter(([name])=>name==='__Host-lingvessa_session');
    const p=await this.identity.authenticate(tokens.length===1?tokens[0]?.[1]??'':'');
    if(mutation){const csrf=r.headers['x-csrf-token'];if(!csrf)throw new ContractError('FORBIDDEN','CSRF token required');this.identity.checkCsrf(p,csrf);
      if(!await this.identity.allowLearningAction(p.userId))throw new ContractError('RATE_LIMITED','Learning action rate limit reached');}
    return p;
  }
}
