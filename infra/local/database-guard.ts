import { loadP1Config } from '../config/runtime.js';

/** Never run bootstrap/reset against production or an arbitrary database. */
export function localDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const config = loadP1Config({ ...env, SERVICE_NAME: 'api' });
  if (config.LINGVESSA_ENV !== 'local' || !config.DATABASE_URL) throw new Error('Local synthetic database required');
  const url = new URL(config.DATABASE_URL);
  if (!['127.0.0.1', 'localhost', '[::1]', 'postgres'].includes(url.hostname) ||
      !/^\/lingvessa_p[123]_(?:local|test_[a-f0-9]+)$/.test(url.pathname)) {
    throw new Error('Bootstrap database must be an isolated local Lingvessa P1/P2/P3 database');
  }
  return config.DATABASE_URL;
}
