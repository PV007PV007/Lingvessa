import 'reflect-metadata';
import { Controller, Get, Header, Inject, Module, ServiceUnavailableException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { HealthProbe } from '../../../infra/health/probe.js';
import type { IdentityRepository } from '../../../infra/persistence/identity.js';
import type { ContentRepository } from '../../../infra/persistence/content.js';
import type { LessonRepository } from '../../../infra/persistence/lessons.js';
import { AuthController, ProfileController, CatalogController, FoundationExceptionFilter, IDENTITY, CONTENT } from './foundation.js';
import { LessonRunsController, LESSONS } from './lessons.js';

import {ReviewController,P4} from './review.js';
import type {P4Services} from './review.js';

import {MediaController,MEDIA} from './media.js';
import type {MediaRepository} from '../../../infra/persistence/media.js';

const PROBE = Symbol('P1_HEALTH_PROBE');

@Controller('health')
class HealthController {
  constructor(@Inject(PROBE) private readonly probe: HealthProbe) {}

  @Get('live')
  @Header('Cache-Control', 'no-store')
  live() { return { status: 'ok' }; }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async ready() {
    const ready = await this.probe.ready().catch(() => false);
    if (!ready) throw new ServiceUnavailableException({ status: 'not_ready' });
    return { status: 'ready' };
  }
}

export async function createApi(probe: HealthProbe, foundation?: { identity: IdentityRepository; content: ContentRepository; lessons?: LessonRepository; p4?:P4Services;media?:MediaRepository }) {
  @Module({ controllers: [HealthController, ...(foundation ? [AuthController, ProfileController, CatalogController, ...(foundation.lessons ? [LessonRunsController] : []), ...(foundation.p4?[ReviewController]:[]),...(foundation.media?[MediaController]:[])] : [])],
    providers: [{ provide: PROBE, useValue: probe }, ...(foundation ? [{ provide: IDENTITY, useValue: foundation.identity }, { provide: CONTENT, useValue: foundation.content }, ...(foundation.lessons ? [{ provide: LESSONS, useValue: foundation.lessons }] : []), ...(foundation.p4?[{provide:P4,useValue:foundation.p4}]:[]),...(foundation.media?[{provide:MEDIA,useValue:foundation.media}]:[])] : [])] })
  class P1Module {}
  const app = await NestFactory.create(P1Module, { logger: false, abortOnError: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new FoundationExceptionFilter());
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  return app;
}
