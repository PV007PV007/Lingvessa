import pg from 'pg';
import type { RuntimeConfig } from '../config/runtime.js';

export interface HealthProbe {
  ready(): Promise<boolean>;
  close(): Promise<void>;
}

export function postgresProbe(config: RuntimeConfig): HealthProbe {
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: 2, connectionTimeoutMillis: config.DATABASE_CONNECT_TIMEOUT_MS,
    query_timeout: config.DATABASE_CONNECT_TIMEOUT_MS,
    statement_timeout: config.DATABASE_CONNECT_TIMEOUT_MS,
    idleTimeoutMillis: 5000,
  });
  let draining = false;
  // Idle connection errors must not crash the process or expose datasource details.
  pool.on('error', () => undefined);
  return {
    async ready() {
      if (draining) return false;
      try {
        await pool.query('SELECT 1 FROM p1_bootstrap.fixtures LIMIT 1');
        return !draining;
      } catch { return false; }
    },
    async close() {
      if (draining) return;
      draining = true;
      await pool.end();
    },
  };
}
