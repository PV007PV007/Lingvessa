import 'reflect-metadata';
import { Controller, Get, Header, Inject, Module, ServiceUnavailableException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { HealthProbe } from '../../../infra/health/probe.js';

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

export async function createApi(probe: HealthProbe) {
  @Module({ controllers: [HealthController], providers: [{ provide: PROBE, useValue: probe }] })
  class P1Module {}
  const app = await NestFactory.create(P1Module, { logger: false, abortOnError: false });
  app.setGlobalPrefix('api/v1');
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  return app;
}
