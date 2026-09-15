# ADR-P2-IDENTITY — P2 credential and session implementation

Status: IMPLEMENTED WITHIN LOCKED DEFAULT; accepted when the owner accepts the P2 milestone PR.

## Authority

Resolves implementation detail OD-002 under TS §40.2 ADR-003 p22 and TD §§27, 35 p17/p20. It does not change the approved architecture: server-side revocable sessions and Argon2id remain mandatory. Public registration is not enabled before the jurisdiction/age decision due at P13.

## Decision

- Node 24.19.0 built-in asynchronous `crypto.argon2('argon2id', ...)`, pinned by the P1 toolchain, performs password derivation. Its API is experimental, so the exact Node patch pin is part of this choice and must not drift without an ADR/test update.
- PHC-compatible record: `$argon2id$v=19$m=65536,t=3,p=1$<salt>$<tag>`; random 16-byte salt; 32-byte tag; memory 65,536 KiB; 3 passes; parallelism 1; policy code `argon2id-node24-m65536-t3-p1-v1` stored with each credential.
- Imported hashes with other work factors are not evaluated. Parameter/version changes require an explicit new verifier policy and rehash-on-authentication migration; no silent reinterpretation.
- Opaque 32-byte session and CSRF tokens are independently generated; only SHA-256 token hashes are stored. Sessions expire after 12 hours, are revocable, and use `Secure; HttpOnly; SameSite=Strict; Path=/` host cookies. Mutations use a stored-hash synchronizer CSRF token.
- User status, credential or role changes revoke all active sessions and create immutable audit events. Login throttling is 8 attempts per 15-minute IP and normalized-identity window in PostgreSQL. Production distributed edge throttling can add a defense layer without replacing this server rule.
- Controlled provisioning exists for fixtures/administration only. There is no public registration endpoint in P2.

## Evidence and consequences

`infra/security/passwords.ts`, `infra/persistence/identity.ts`, `apps/api/src/foundation.ts`, migration `202609150001_p2_foundation`, unit/integration tests, and `artifacts/p2/password-benchmark.json` are the evidence chain. The benchmark is environment-specific; production capacity must be revalidated against the selected P13 hosting environment. No AI/provider contract is introduced.

Any change to algorithm, stored syntax, work factors, session lifetime/cookie semantics, CSRF, throttling, or public provisioning follows `docs/governance/change-control.md` and requires migration/security tests.
