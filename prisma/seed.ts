import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';
import { localDatabaseUrl } from '../infra/local/database-guard.js';

export async function seedBootstrap(env: NodeJS.ProcessEnv): Promise<void> {
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: localDatabaseUrl(env) }) });
  try {
    const fixtures = ['english', 'czech'].map((name) => JSON.parse(
      readFileSync(new URL(`../tests/fixtures/bootstrap/${name}.json`, import.meta.url), 'utf8'),
    ) as { id: string; stableCode: string; versionCode: string; languageCode: string; locale: string; sampleText: string });
    await client.$transaction(async (tx) => {
      await tx.bootstrapFixture.createMany({ data: fixtures, skipDuplicates: true });
      for (const fixture of fixtures) {
        const stored = await tx.bootstrapFixture.findUniqueOrThrow({ where: { id: fixture.id } });
        for (const key of Object.keys(fixture) as (keyof typeof fixture)[]) {
          if (stored[key] !== fixture[key]) throw new Error('Bootstrap fixture mismatch; refusing to overwrite');
        }
      }
    });
  } finally { await client.$disconnect(); }
}

if (process.argv[1]?.endsWith('/seed.ts')) {
  seedBootstrap(process.env).then(() => console.log('Synthetic EN/CS fixtures ready (2).')).catch(() => {
    console.error('Bootstrap seed failed; credential and query details redacted.');
    process.exitCode = 1;
  });
}
