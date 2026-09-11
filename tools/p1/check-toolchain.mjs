import { readFileSync } from 'node:fs';
const expected = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url)));
if (process.versions.node !== expected.engines.node) {
  console.error(`Required Node ${expected.engines.node}; found ${process.versions.node}`); process.exit(1);
}
const manager = process.env.npm_config_user_agent?.split(' ')[0];
if (manager && manager !== `pnpm/${expected.engines.pnpm}`) {
  console.error(`Required pnpm ${expected.engines.pnpm}`); process.exit(1);
}
console.log(`Toolchain OK: Node ${expected.engines.node}, pnpm ${expected.engines.pnpm}`);
