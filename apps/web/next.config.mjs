import { fileURLToPath } from 'node:url';
export default {
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  poweredByHeader: false,
  reactStrictMode: true,
  // No build-time environment values or provider-specific settings.
};
