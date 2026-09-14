# Portable P1 development stack

Prerequisites: exact Node/pnpm pins; Docker Engine with Compose v2.20+ (Compose
`include`); enough memory for two Next.js production builds. Only local synthetic
data is supported by bootstrap. Remote preview/development is optional and has
not been deployed.

```sh
pnpm install --frozen-lockfile
pnpm bootstrap:local
pnpm check
node --env-file=.local/runtime.env --import tsx --test tests/integration/*.test.ts
pnpm test:containers
```

`test:containers` builds all four OCI-compatible targets, records image IDs bound
to the Git commit, starts the local stack, proves healthy/degraded/recovered DB
readiness, then stops app containers. The existing local PostgreSQL volume is
retained. It does not push images, deploy remotely or modify production.

Node/PostgreSQL base image index digests are pinned in `docs/p1/image-lock.json`.
The source Dockerfile uses those same references. Build tooling is separate from
runtime; Node processes run as the image's non-root `node` user. Runtime secrets
are injected through environment settings, never build args or copied files.

API/worker use `/api/v1/health/live` and `/api/v1/health/ready`. Liveness checks the
HTTP process; readiness requires a reachable, migrated PostgreSQL bootstrap
schema. Frontend `/health/ready` checks the frontend server only, not the API.
No learner or administrative actions are exposed; app roots are static shells.

For later approved remote development, deploy the same images, PostgreSQL and
runtime environment variables behind protected access/TLS. Configure region,
credentials, hostnames, expiry and backups at the hosting boundary. Nothing in
domain or schema refers to Northflank, R2 or any mandatory provider. Production
deployment and its privacy/security release gates remain future work.
