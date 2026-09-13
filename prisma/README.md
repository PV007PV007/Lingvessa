# P1 bootstrap boundary

`202609130001_p1_bootstrap` creates only `p1_bootstrap.fixtures`. These two
synthetic engineering probes exercise UUID, stable code, version code, locale
and Unicode roundtrip. They are not curriculum publications or learner state,
and do not implement or claim P2 language isolation.

Prisma owns migration/client generation; SQL adds the fixture locale CHECK.
No domain schema, roles, sessions, mastery, speech jobs or AI data are added.
P2 will add its governed schema separately. Do not silently repurpose fixture IDs
as domain IDs. Do not edit an applied migration; add a new migration if needed.

```sh
pnpm db:generate
pnpm db:validate
pnpm bootstrap:local
node --env-file=.local/runtime.env --import tsx tools/p1/db-command.ts status
node --env-file=.local/runtime.env --import tsx --test tests/integration/*.test.ts
```

Generation/validation need no database credentials. Migration/seed/status wrappers
require `LINGVESSA_ENV=local` and an isolated database name on a local host. Seed
is repeatable and rejects conflicting fixture bytes instead of overwriting them.
Integration creates a uniquely named temporary database, replays migrate/seed,
checks the actual PostgreSQL version and DB constraints, and drops only that
temporary database in `finally`.

Local rollback/reset: stop the four apps; run
`docker compose --env-file .local/runtime.env -f infra/local/compose.yml down -v`
only for this disposable local Compose project, then `pnpm bootstrap:local`.
This destroys the synthetic local volume. It is not a production rollback method.
Later production changes follow expand/migrate/contract and approved backup/restore
policy. No production deployment or database is authorized by P1.
