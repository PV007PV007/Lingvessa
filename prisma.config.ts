import { defineConfig } from 'prisma/config';

// Schema generation/validation do not need credentials. DB commands use the
// guarded tools/p1/db-command.ts wrapper and require an injected local URL.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node --import tsx prisma/seed.ts' },
  ...(process.env.DATABASE_URL ? { datasource: { url: process.env.DATABASE_URL } } : {}),
});
