# Lingvessa P1 engineering foundation

**P1: PASS — READY FOR OWNER ACCEPTANCE**. P0 accepted; P2 not authorized.
Single final owner-verified hosted-CI-tested SHA: `3b0a45e2c143fb538edb7a626f8c84356cdcc34f`.

Read `00_CONTEXT/01_implementation_state_and_handoff.md` and `docs/p1/exit-evidence.md`.
Current evidence is `docs/p1/closure/current-validation.json`. Raw historical local
reports remain in `docs/p1/evidence/`; their older environment failure is superseded
by owner-verified hosted success on this exact SHA.

Private GitHub repository connected; PR #1 **P1: engineering foundation** is OPEN,
base main, compare implementation/p1-foundation. Workflow **P1 foundation**, job
**p1-exit**, passed for push and pull_request with required DB/OCI steps executed,
per owner verification. No automatic merge.

**Main is not technically protected.** EXC-P1-001 records the owner's current solo
development process controls and plan limitation. No paid plan purchase is required
by this decision. See `docs/p1/closure/operational-exception.md`.

Exact tooling: Node 24.19.0, pnpm 11.19.0, PostgreSQL 18.6. P1 runtime reproduction:

```sh
pnpm install --frozen-lockfile
pnpm validate:baseline
pnpm check
pnpm audit:dependencies
pnpm bootstrap:local
node --env-file=.local/runtime.env --import tsx --test tests/integration/*.test.ts
pnpm test:containers
```

Required runtime host has Docker/Compose. These are the unchanged commands from
the tested source; this closure batch did not rerun them. Only document/source
reconciliation is newly executed. All runtime code remains at the tested SHA.
The complete package includes tested Git history and an explicit reporting overlay.
No future lesson/mastery/speech/AI implementation is included.

**Owner reviews PR #1 and accepts P1 separately. Stop before P2.**
