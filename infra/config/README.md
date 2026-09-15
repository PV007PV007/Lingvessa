# Runtime configuration

`runtime.ts` is the single server-side typed schema in all environments. It is
infrastructure, not a domain package or a client import. API/worker require an
injected PostgreSQL URL; web/admin do not receive it. No production credentials
or learner data belong in local/preview environments.

Copy `.env.example` locally and inject `DATABASE_URL` through your shell/secret
manager, or use `pnpm bootstrap:local` once Docker is available. Local bootstrap
creates ignored, randomly generated credentials. Do not add a password to the
versioned example. Run `pnpm config:check` with runtime variables injected.

All `NEXT_PUBLIC_*` values are rejected in P1. Later public configuration needs an
explicit reviewed allowlist. Build artifacts never require database/provider
credentials. Startup diagnostics expose service/environment/phase only.

AI fields retain the governing names and default to OFF / Manual / free-only /
zero paid budget / empty allowlists and quotas. The P1 startup gate rejects any
attempt to activate them. It is a phase guard, not the P8 policy engine, a role
grant or the P9 learner opt-in contract. A feature flag never grants permission.

Secrets are runtime injections, never Docker build args, Next.js `env` config,
source files, content JSON or diagnostics. For production/preview, supply access
protection and secret management through the deployment platform before exposure.
