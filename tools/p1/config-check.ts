import { loadP1Config, safeStartupRecord } from '../../infra/config/runtime.js';

try {
  console.log(JSON.stringify({ config: 'valid', ...safeStartupRecord(loadP1Config(process.env)) }));
} catch {
  console.error('Invalid P1 runtime configuration. Check the typed schema; values are redacted.');
  process.exitCode = 1;
}
