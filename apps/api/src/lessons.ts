import { Body, Controller, Get, Header, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { UUID_PATTERN, ContractError } from '../../../packages/domain/src/identity.js';
import type { IdentityRepository } from '../../../infra/persistence/identity.js';
import type { LessonRepository } from '../../../infra/persistence/lessons.js';
import { IDENTITY } from './foundation.js';

export const LESSONS = Symbol('P3_LESSONS');
type Request = { headers: Record<string, string | undefined>; query: Record<string, string | undefined> };
const uuid = z.string().regex(UUID_PATTERN);
const cookieName = '__Host-lingvessa_session';
const tokenFrom = (request: Request) => {
  const matching = (request.headers.cookie ?? '').split(';').map((part) => part.trim().split('=')).filter(([name]) => name === cookieName);
  return matching.length === 1 ? matching[0]?.[1] ?? '' : '';
};

@Controller('lesson-runs')
export class LessonRunsController {
  constructor(
    @Inject(IDENTITY) private readonly identity: IdentityRepository,
    @Inject(LESSONS) private readonly lessons: LessonRepository,
  ) {}

  @Post()
  @Header('Cache-Control', 'private, no-store')
  async start(@Req() request: Request, @Body() body: unknown) {
    const principal = await this.principalForMutation(request);
    return this.lessons.start(principal.userId, body);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(@Req() request: Request) {
    const principal = await this.identity.authenticate(tokenFrom(request));
    const profileId = uuid.parse(request.query.language_profile_id);
    return this.lessons.list(principal.userId, profileId);
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  async get(@Req() request: Request, @Param('id') id: string) {
    const principal = await this.identity.authenticate(tokenFrom(request));
    return this.lessons.get(principal.userId, uuid.parse(id));
  }

  @Post(':id/attempts')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  async attempt(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    const principal = await this.principalForMutation(request);
    return this.lessons.submit(principal.userId, uuid.parse(id), body);
  }

  @Post(':id/exit')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  async exit(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    const principal = await this.principalForMutation(request);
    return this.lessons.exit(principal.userId, uuid.parse(id), body);
  }

  private async principalForMutation(request: Request) {
    const principal = await this.identity.authenticate(tokenFrom(request));
    const csrf = request.headers['x-csrf-token'];
    if (!csrf) throw new ContractError('FORBIDDEN', 'CSRF token required');
    this.identity.checkCsrf(principal, csrf);
    return principal;
  }
}
