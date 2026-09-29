import pg from 'pg';
import {readFileSync} from 'node:fs';
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
    // Prisma can leave an empty migration log. Reproduce only trusted transactional DDL,
    // in the already-guarded synthetic local database, and always roll back.
    if(!details && /^20[0-9]{10}_p[1-5]_[a-z_]+$/u.test(row.migration_name)){
      const ddl=readFileSync(`prisma/migrations/${row.migration_name}/migration.sql`,'utf8');
      if(!/\bBEGIN;/u.test(ddl)||!/COMMIT;\s*$/u.test(ddl))continue;
      await db.query('BEGIN');
      try{await db.query(ddl.replace(/\bBEGIN;/u,'').replace(/COMMIT;\s*$/u,''));}
      catch(error){if(error instanceof pg.DatabaseError)console.log(JSON.stringify({migration:row.migration_name,code:error.code,message:error.message,position:error.position}));}
      finally{await db.query('ROLLBACK');}
    }
  }
} catch { console.error('Migration diagnostics unavailable; no datasource details emitted.'); process.exitCode = 1; }
finally { await db.end(); }
