# Lingvessa engineering foundation

Owner-locked baseline: `docs/baseline/baseline.yml`. P0 was accepted; only P1 is authorized.
Execution authority: Implementation Plan v1.4. Task order: IMP-P1-001 → 002 → 003 → 004.

Node 24.19.0, pnpm 11.19.0, PostgreSQL 18.6. All direct dependencies and the lockfile are pinned.

```sh
pnpm install --frozen-lockfile
pnpm check
```

The P0 snapshot is preserved by tag `p0-accepted-2026-09-11`; its validator applies to that snapshot, not to the active P1 tree.
The repository is local and non-public. No GitHub remote or PR has been created. Connect a private remote and enable the repository rules before shared development.
