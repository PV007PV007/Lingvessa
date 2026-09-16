import { fileURLToPath } from 'node:url';
export default {
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  poweredByHeader: false,
  reactStrictMode: true,
  webpack(config) {
    config.resolve.extensionAlias = { ...config.resolve.extensionAlias, ".js": [".ts", ".tsx", ".js"] };
    return config;
  },
  // No build-time environment values or provider-specific settings.
};
