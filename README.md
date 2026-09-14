# Lingvessa engineering foundation

Owner-locked baseline: `docs/baseline/baseline.yml`. P0 was accepted; only P1 is authorized.
Execution authority: Implementation Plan v1.4. Task order: IMP-P1-001 → 002 → 003 → 004.

Node 24.19.0, pnpm 11.19.0, PostgreSQL 18.6. All direct dependencies and the lockfile are pinned.

```sh
pnpm install --frozen-lockfile
pnpm validate:baseline
pnpm check
pnpm audit:dependencies
pnpm bootstrap:local
node --env-file=.local/runtime.env --import tsx --test tests/integration/*.test.ts
pnpm test:containers
```

`node tools/p1/run-validation.mjs` executes these gates in order and writes exact
commands, statuses and logs under ignored `artifacts/p1`. It reports NOT_READY
when PostgreSQL or container gates cannot run; a green unit suite is insufficient.

Current delivery is P1 foundation with DB/container acceptance pending. Read
`00_CONTEXT/01_implementation_state_and_handoff.md` and `docs/p1/exit-evidence.md`.
Do not start P2. No lesson, domain schema, mastery, speech or AI runtime is present.

Runtime: API/worker entrypoints compile to root `dist/`; their runtime dependencies
are declared in the root package. Web/admin have workspace manifests and Next.js
standalone outputs. Core packages are deliberately empty boundaries until their
governed implementation phases. Development setup is in `infra/development/README.md`.

The P0 snapshot is preserved by tag `p0-accepted-2026-09-11`; its validator applies to that snapshot, not to the active P1 tree.
The repository is local and non-public. No GitHub remote or PR has been created. Connect a private remote and enable the repository rules before shared development.

Private GitHub setup: push the included Git history to the owner's private remote,
open a reviewed PR from `implementation/p1-foundation`, and apply
`.github/repository-rules.json` to protect main. No rule is claimed active until it
is applied remotely. No image publication or remote deployment was performed.

The original trace CSV/catalog remains the accepted P0 plan. Join
`docs/p1/requirement-evidence.json` by requirement_id for current code/test status;
the overlay explicitly distinguishes foundation evidence from future acceptance.
