# P2 migration, schema and API evidence

Tested implementation: `247574352ee5f89ca7ee2172d92a008137c11dd7`.

## Database

The additive migration `202609150001_p2_foundation` retains the P1 bootstrap migration and creates the P2 public-schema foundation: users, credentials, sessions, roles, consents, language profiles/settings, shared curriculum hierarchy, typed knowledge/evidence maps, content versions/references/translations/validations/approvals, immutable publications/entries/edge snapshots/pointers, and selection context. Composite foreign keys and guards bind owner + profile + language and content + language. No cascade-delete foreign key exists.

Published content, publication snapshots, entries, translations, resolved references, approvals, audit records and publication pointers are protected against silent historical rewrite. Rollback changes the active pointer with optimistic revision; it never rewrites a publication.

The clean PostgreSQL 18.6 introspection contains the same 36 models as the committed Prisma view. The only deliberate view normalization is Prisma's partial-index relation inference for `variants_one_default`; see `schema-introspection.json`.

## API

`infra/contracts/p2.openapi.json` is OpenAPI 3.1.2 and contains only the P2 foundation routes: login/logout, current user/settings, language profiles, active language, and published catalog. There is no public registration, Lesson Engine, mastery/Review, speech/media or AI runtime route.

## Phase boundary

P3 tables and runtime are absent by test. Future learner-state tables must add the same composite owner/profile/language keys when their authorized phase creates them; P2 does not pre-create them.
