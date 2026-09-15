# P1 compatibility and dependency review

Initial stable framework pins: Node 24.19.0 (24 LTS), pnpm 11.19.0,
TypeScript 6.0.3, Next 16.3.4 / React 19.3.0, Nest 12.0.1,
Prisma client/CLI/adapter 7.10.0. Prisma's `latest` tag is a prerelease;
the stable 7.10.0 line is intentional. TS 6 fits the selected ESLint tooling's
peer range. PostgreSQL remains 18.6.

The first dependency scan found five high advisories, a moderate and a low in
upstream transitive versions. Narrow exact overrides in `pnpm-workspace.yaml`
replace them without changing framework families or architecture:

| Parent | Dependency | Locked remediation | Evidence to rerun |
| --- | --- | --- | --- |
| @prisma/config 7.10.0 | deepmerge-ts 7.1.5 | 8.0.2 | Prisma config load, generate, validate, real migration gate |
| prisma 7.10.0 | mysql2 3.15.3 | 3.24.4 | Prisma CLI/config; no MySQL usage in Lingvessa |
| @nestjs/platform-express 12.0.1 | multer 2.2.0 | 2.3.0 | Nest HTTP/health tests; no upload endpoint in P1 |

No advisory is suppressed. The production dependency audit remains a required
CI gate. Full DB and OCI execution must still pass before P1 acceptance.
Review/remove the narrow overrides when upstream pins a patched dependency;
do not silently drop them during a lockfile refresh.

Primary references: [Node lifecycle](https://nodejs.org/en/about/previous-releases),
[Next installation](https://nextjs.org/docs/app/getting-started/installation),
[PostgreSQL minor policy](https://www.postgresql.org/support/versioning/),
[Deepmerge advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx),
[MySQL2 advisory](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr),
[Multer advisory](https://github.com/advisories/GHSA-535w-7cp7-47q4).
Exact package metadata was read from the npm registry on 2026-09-11/13.
