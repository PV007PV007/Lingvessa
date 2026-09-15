import pg from 'pg';
import { localDatabaseUrl } from '../../infra/local/database-guard.js';
const db = new pg.Client({ connectionString: localDatabaseUrl(process.env) });
try {
  await db.connect();
  const rows = (await db.query('SELECT migration_name,logs FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL')).rows;
  for (const row of rows) {
    let details = String(row.logs ?? '');
    for (const [key, value] of Object.entries(process.env)) if (value && /PASSWORD|TOKEN|SECRET|DATABASE_URL/u.test(key)) details = details.split(value).join('[REDACTED]');
    details = details.replace(/\b(?:postgresql|postgres|https?):\/\/\S+/gu, '[REDACTED_URL]');
    console.log(JSON.stringify({ migration: row.migration_name, diagnostics: details }));
  }
} catch { console.error('Migration diagnostics unavailable; no datasource details emitted.'); process.exitCode = 1; }
finally { await db.end(); }
