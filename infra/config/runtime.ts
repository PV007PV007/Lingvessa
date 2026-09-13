import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((v) => v === 'true');
const port = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(65535));
const budget = z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).pipe(z.number().finite().nonnegative());
const csv = z.string().transform((v) => v === '' ? [] : v.split(',').map((s) => s.trim()))
  .refine((v) => v.every((s) => /^[a-zA-Z0-9._:/-]+$/.test(s)), 'Invalid allowlist');

/** One schema for local, preview, staging and production. No credential defaults. */
export const runtimeConfigSchema = z.object({
  LINGVESSA_ENV: z.enum(['local', 'preview', 'staging', 'production']),
  SERVICE_NAME: z.enum(['web', 'admin', 'api', 'worker']),
  HOST: z.enum(['127.0.0.1', '0.0.0.0']).default('127.0.0.1'),
  PORT: port.default(3000),
  DATABASE_URL: z.url().optional(),
  DATABASE_CONNECT_TIMEOUT_MS: z.string().regex(/^\d+$/).transform(Number)
    .pipe(z.number().int().min(100).max(10000)).default(1500),
  AI_ENABLED: booleanString.default(false),
  LEARNER_AI_ENABLED: booleanString.default(false),
  ADMIN_AI_ENABLED: booleanString.default(false),
  AI_MODE: z.enum(['manual', 'assist', 'auto']).default('manual'),
  AI_FREE_ONLY: booleanString.default(true),
  PAID_INFERENCE_ENABLED: booleanString.default(false),
  MONTHLY_PAID_BUDGET: budget.default(0),
  AI_PROVIDER_ALLOWLIST: csv.default([]),
  AI_MODEL_ALLOWLIST: csv.default([]),
  AI_CAPABILITY_QUOTAS: z.string().default('{}').transform((value, context) => {
    try {
      const parsed: unknown = JSON.parse(value);
      return z.record(z.string().regex(/^[a-z][a-z0-9_.-]*$/), z.number().int().nonnegative()).parse(parsed);
    } catch {
      context.addIssue({ code: 'custom', message: 'Invalid quota map' });
      return z.NEVER;
    }
  }),
}).superRefine((value, context) => {
  const needsDb = value.SERVICE_NAME === 'api' || value.SERVICE_NAME === 'worker';
  if (needsDb && !value.DATABASE_URL) {
    context.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'Required for service' });
  }
  if (value.DATABASE_URL) {
    const url = URL.parse(value.DATABASE_URL);
    if (!url) {
      context.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'PostgreSQL URL required' });
      return;
    }
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname === '/') {
      context.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'PostgreSQL URL required' });
    }
  }
  if (!value.PAID_INFERENCE_ENABLED && value.MONTHLY_PAID_BUDGET !== 0) {
    context.addIssue({ code: 'custom', path: ['MONTHLY_PAID_BUDGET'], message: 'Disabled paid inference requires zero budget' });
  }
});

export type RuntimeConfig = Readonly<z.output<typeof runtimeConfigSchema>>;

export class ConfigurationError extends Error {
  constructor(public readonly fields: readonly string[]) {
    super(`Invalid configuration fields: ${fields.join(', ')}`);
    this.name = 'ConfigurationError';
  }
}

export function parseRuntimeConfig(env: NodeJS.ProcessEnv): RuntimeConfig {
  // Nothing is implicitly public in P1. Next.js automatically embeds these values.
  const publicKeys = Object.keys(env).filter((key) => key.startsWith('NEXT_PUBLIC_'));
  if (publicKeys.length) throw new ConfigurationError(publicKeys);
  const result = runtimeConfigSchema.safeParse(env);
  if (!result.success) {
    // Never include Zod issues/input values: those can contain credentials.
    throw new ConfigurationError([...new Set(result.error.issues.map((i) => String(i.path[0] ?? 'environment')))]);
  }
  return Object.freeze(result.data);
}

/** Phase gate, NOT an AI authorization policy or learner consent implementation. */
export function assertP1Capabilities(config: RuntimeConfig): void {
  if (config.AI_ENABLED || config.LEARNER_AI_ENABLED || config.ADMIN_AI_ENABLED ||
      config.AI_MODE !== 'manual' || !config.AI_FREE_ONLY || config.PAID_INFERENCE_ENABLED ||
      config.MONTHLY_PAID_BUDGET !== 0 || config.AI_PROVIDER_ALLOWLIST.length ||
      config.AI_MODEL_ALLOWLIST.length || Object.keys(config.AI_CAPABILITY_QUOTAS).length) {
    throw new ConfigurationError(['AI capabilities unavailable before P8/P9 gates']);
  }
}

export function loadP1Config(env: NodeJS.ProcessEnv): RuntimeConfig {
  const config = parseRuntimeConfig(env);
  assertP1Capabilities(config);
  return config;
}

export function safeStartupRecord(config: RuntimeConfig) {
  return { service: config.SERVICE_NAME, environment: config.LINGVESSA_ENV, phase: 'P1' as const };
}
