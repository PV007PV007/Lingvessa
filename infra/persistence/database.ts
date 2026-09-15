import pg from 'pg';
export function createFoundationPool(connectionString: string): pg.Pool {
  const pool = new pg.Pool({ connectionString, max: 8, connectionTimeoutMillis: 3000, statement_timeout: 15000, idleTimeoutMillis: 5000 });
  pool.on('error', () => undefined);
  return pool;
}
export async function transaction<T>(pool: pg.Pool, operation: (db: pg.PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try { await db.query('BEGIN'); const result = await operation(db); await db.query('COMMIT'); return result; }
  catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
}
