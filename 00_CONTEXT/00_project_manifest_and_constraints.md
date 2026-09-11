# 00_project_manifest_and_constraints.md

# Lingvessa — Project Manifest and Architectural Constraints

**Document type:** Architecture Decision Record (ADR) / Project Manifest  
**Purpose:** Provide authoritative architectural context for external model audits and implementation.  
**Status:** OWNER-LOCKED architecture/context authority for implementation.
**Baseline synchronized:** 2026-09-10 OWNER LOCKED.  
**Owner lock:** 2026-09-10 by product owner.  
**Closure audit result:** BLOCKER 0 / IMPORTANT 0; remaining MINOR editorial residues corrected before lock.  
**Execution authority:** `Lingvessa_Implementation_Plan`  
**Product:** Lingvessa

---

# 1. НАЗВА ПРОЄКТУ ТА КОНТЕКСТ

## 1.1 Product

**Lingvessa** — multilingual, content-driven language-learning platform for independent study.

Initial target languages:

- English:
  - `en-GB` — default variety;
  - `en-US` — selectable variety.
- Czech:
  - `cs-CZ`.
- Initial interface/explanation locale:
  - `uk-UA`.

The system is designed from the beginning for adding additional target languages without creating separate application forks.

Initial delivery architecture:

- responsive Web/PWA;
- learner application;
- Admin/CMS;
- shared Lesson Engine;
- shared Review Engine;
- shared two-level Mastery Engine;
- Media/Speech subsystem;
- optional provider-agnostic AI layer;
- PostgreSQL as authoritative persistent state;
- versioned content and media;
- modular monolith + workers.

The first implementation target is a production-shaped bilingual reference implementation, not the whole A1–C1 library:

- `E-A1-M01` — English reference module;
- `C-A1-M01` — Czech reference module.

Both MUST run through the same engines and contracts.

The reference modules validate:

- content schemas;
- language isolation;
- activity renderers;
- evaluator rules;
- mastery/evidence mapping;
- Review;
- speech;
- media;
- accessibility;
- optional AI;
- regression behavior.

Bulk A1 content is intentionally delayed until the common engine is validated.

## 1.2 Core system invariants

The following are approved project decisions. An architecture audit MUST verify that implementation and documents conform to these decisions. An audit MUST NOT classify the decisions themselves as defects merely because an alternative architecture is possible.

1. One application architecture serves English and Czech.
2. Language-specific behavior is configuration/evaluator/linguistic strategy, not application forks.
3. PostgreSQL is the authoritative persistent state.
4. Published content is versioned and immutable.
5. Attempts and evidence are immutable historical records.
6. Mastery is derived from evidence and is recomputable.
7. There are exactly six global mastery skills.
8. Detailed mastery is tracked at knowledge-item facet level.
9. Server-side evaluation is authoritative.
10. Required lesson media is prepared/generated before publication.
11. Ordinary lesson completion MUST NOT depend on live image/audio generation.
12. Speech failure MUST NOT block course progression.
13. AI is an optional capability layer.
14. Core learning MUST remain functional with every AI provider disabled.
15. AI is provider-agnostic.
16. Initial AI policy is free/local-first.
17. Paid AI is disabled by default.
18. Initial paid AI budget is `0`.
19. PWA/Web is implemented before native mobile applications.
20. Modular monolith is the default architecture; microservices require measured need and ADR.
21. English and Czech are both real launch languages.
22. Required educational images/audio are generated or programmatically produced by the system/tooling; learners are never expected to source lesson media.
23. Babbel and other products may be used only as methodological/UX references; proprietary lesson content, media, branding, source code or recognizable trade dress MUST NOT be copied.

---

# 2. ЗАТВЕРДЖЕНІ АРХІТЕКТУРНІ РІШЕННЯ

## 2.1 DB-level English/Czech isolation

### Decision

English and Czech learner state is isolated at database level, not only in frontend state or application-service checks.

The isolation key is conceptually:

`user + language_profile + language`

Switching the active target language changes the active learning context but MUST NOT mutate the other language state.

Isolated state includes:

- course position;
- lesson runs;
- attempts;
- evidence;
- mastery;
- Review schedules;
- mistakes;
- collections;
- AI learner sessions;
- language-specific preferences where applicable.

### Database strategy

PostgreSQL uses explicit `language_id` on learner-state tables where required so composite foreign keys can prove lineage.

#### `language_profiles`

Required uniqueness:

```text
UNIQUE(id, user_id, language_id)
UNIQUE(user_id, language_id)
```

A learner has one language profile per target language.

#### Content lineage

Language-bound content entities expose keys equivalent to:

```text
UNIQUE(id, language_id)
```

This applies where relevant to lessons, items, knowledge items, publications and content versions.

#### `lesson_runs`

Conceptual columns:

```text
id
user_id
language_profile_id
language_id
publication_id
lesson_id
...
```

Required lineage constraints include:

```text
FK(language_profile_id, user_id, language_id)
    -> language_profiles(id, user_id, language_id)

FK(publication_id, language_id)
    -> publications(id, language_id)

FK(lesson_id, language_id)
    -> lessons(id, language_id)
```

The runtime cannot create an English lesson run using a Czech language profile.

#### `activity_attempts`

Attempts carry:

```text
user_id
language_profile_id
language_id
lesson_run_id
item_id
content_version_id
...
```

Composite FKs bind the attempt to its owner, language profile, lesson run, language-scoped item and language-scoped content version.

The database MUST reject:

- foreign-user attempts;
- English attempt + Czech item;
- Czech profile + English lesson run;
- mismatched publication/content lineage.

#### `evidence_events`

Evidence inherits owner and language lineage from its attempt.

Conceptual fields include:

```text
attempt_db_id
user_id
language_profile_id
language_id
knowledge_item_id
skill
facet
...
```

Required invariant:

```text
FK(
    attempt_db_id,
    user_id,
    language_profile_id,
    language_id
)
-> activity_attempts(...)
```

Knowledge/content references also include language lineage.

Facet evidence requires a knowledge item:

```text
CHECK (
    facet IS NULL
    OR knowledge_item_id IS NOT NULL
)
```

#### Review / collections

Review schedules and collections are constrained to user + language_profile + language + knowledge lineage.

No Czech Review candidate may appear in an English Review session and vice versa.

#### Learner AI

For learner-originated AI runs, `actor_id`, `language_profile_id` and `language_id` are required and must belong to the same learner/language lineage.

#### Complex lineage

If a required invariant cannot be represented safely through a simple FK, PostgreSQL `DEFERRABLE` constraint triggers MAY be used.

### Required negative fixtures

The DB test suite MUST include at minimum:

```text
English profile -> Czech lesson            => reject
English attempt -> Czech knowledge item    => reject
User A attempt -> User B evidence           => reject
English attempt -> Czech evidence           => reject
English review -> Czech candidate           => reject
User A -> User B language profile AI run    => reject
```

Application-level authorization remains required, but it is not a substitute for DB constraints.

---

## 2.2 Async speech API and pronunciation contracts

### UX decision

Pronunciation uses a simple learner-facing result:

```text
microphone pressed
    ->
recording / pulsing microphone
    ->
processing
    ->
correct | try again | unavailable
```

Raw provider scores are not the primary learner UX.

### Canonical speech result enum

Only these runtime result states are canonical:

```text
speech_correct
speech_incorrect
speech_unavailable
```

Legacy labels such as `speech_feedback_correct` or `speech_feedback_retry` are invalid.

### `speech_correct`

Conditions:

- speech is usable;
- confidence is sufficient;
- evaluator determines the target pronunciation/intelligibility criterion is met.

Effects:

- bounded positive evidence MAY be generated;
- evidence targets the exact Pronunciation facet declared by `evidence_map`;
- Auto-advance MAY occur after feedback dwell if enabled;
- otherwise `Далі` becomes available.

### `speech_incorrect`

Conditions:

- speech is usable;
- confidence is sufficient;
- target criterion is not met.

Effects:

- bounded negative/practice-needed evidence MAY be generated;
- only the exact Pronunciation facet declared by `evidence_map` is affected;
- state is non-blocking;
- learner can Retry or Continue;
- Auto-advance MAY proceed after visible feedback dwell when enabled.

### `speech_unavailable`

Examples:

- microphone denied or absent;
- provider timeout/failure;
- confidence below usable threshold;
- learner cancellation;
- terminal scoring failure.

Effects:

```text
mastery update = none
lesson blocking = false
```

Provider failure is not learner failure.

### Pronunciation evidence rule

Pronunciation mastery requires evaluable learner speech.

A non-speaking task MUST NOT create Pronunciation evidence merely because it contains pronunciation-related audio/content.

Examples such as tapping the stressed syllable, identifying stress or selecting a sound are receptive tasks and normally map to Listening evidence, not Pronunciation.

### Pronunciation facets

Speech activities may explicitly target:

```text
pronunciation_target
intelligibility
```

`speech_correct` and `speech_incorrect` use the exact facet declared in `evidence_map`. The runtime MUST NOT automatically replace one with the other.

### Async speech-job lifecycle

Canonical lifecycle:

```text
created
  ->
uploaded
  ->
queued
  ->
processing
  ->
succeeded
| unavailable
| failed
| cancelled
| expired
```

### Canonical API

Create job:

```http
POST /api/v1/speech/jobs
```

Request context includes:

```text
Idempotency-Key
attempt_id
language_profile_id
lesson_run_id
item_id
content_version_id
```

Response includes:

```text
job_id
single-use upload_url
```

Upload audio:

```http
PUT {upload_url}
```

Submit for scoring:

```http
POST /api/v1/speech/jobs/{job_id}/submit
```

Poll:

```http
GET /api/v1/speech/jobs/{job_id}
```

Cancel:

```http
POST /api/v1/speech/jobs/{job_id}/cancel
```

Cancellation is idempotent and settles the associated speech attempt once as:

```text
speech_unavailable
reason = user_cancelled
```

### Idempotency semantics

Network retry:

```text
same attempt_id
same idempotency key
same job
```

No duplicate evidence.

Learner Retry after terminal result:

```text
new attempt_id
new speech job
```

Historical attempts/evidence remain immutable.

### Terminal settlement

A speech attempt is finalized exactly once.

```text
succeeded + match
    -> speech_correct

succeeded + mismatch
    -> speech_incorrect

unavailable
failed after bounded retry
expired
cancelled
    -> speech_unavailable
```

Duplicate or late provider callbacks after settlement are ignored and audited.

### Callback validation

Callbacks MUST validate signature/origin, timestamp/replay window, job ID, owner/profile context, provider/model version and settlement status.

### Audio retention

Raw learner microphone audio is transient by default.

Target rule:

```text
delete at terminal settlement/cancel
OR
TTL <= 15 minutes
```

Raw microphone bytes are not written to ordinary logs, analytics or permanent object storage without a future explicit consent/retention policy.

---

## 2.3 AI foundation, limits and permissions

### Architectural position

AI is an optional capability layer around the deterministic learning platform.

The following MUST remain functional when AI is disabled:

- login;
- course navigation;
- published lessons;
- deterministic exercise evaluation;
- progress;
- mastery;
- Review;
- remediation;
- collections;
- standard published audio/images;
- English/Czech switching.

### Shared AI foundation

Canonical request path:

```text
Learner UI / Admin UI
        |
        v
Lingvessa Application API
        |
        v
AI Gateway / Orchestrator
        |
        +-> Policy Engine
        +-> Grounding Builder
        +-> Provider Router
        +-> Provider Adapter
        +-> Structured Output Validator / Safety
        +-> Usage Meter
        +-> Audit
        |
        v
Result or deterministic fallback
```

Frontend clients MUST NOT call AI vendors directly.

Provider SDK types MUST NOT leak into domain/content schemas.

### AI Gateway / Orchestrator

Responsible for capability resolution, context assembly, policy execution, provider routing, structured response validation, fallback selection and audit association.

It does not directly modify mastery, publication, roles, billing or security state.

### Policy Engine

Evaluates:

```text
actor role
capability
data sensitivity
feature flags
AI mode
provider allowlist
model allowlist
learner consent
quota
paid/free policy
```

### Grounding Builder

Uses only minimum required context from approved curriculum/knowledge/current lesson/relevant learner state.

Published Lingvessa knowledge is pedagogical authority over generic model memory.

### Provider Router

Routing order is policy-oriented:

```text
1. privacy/data eligibility
2. capability compatibility
3. target language/variety suitability
4. free-only / paid policy
5. quota availability
6. model quality
7. latency/provider health
8. configured fallback order
```

A cheaper/free provider MUST NOT bypass data policy.

### Provider adapters

Canonical location:

```text
/packages/provider-adapters/
    ai/
    speech/
    tts/
    image/
    email/
    storage/
```

There is no separate canonical `/packages/ai-adapters`.

### Output Validator

Validates schema, expected language, variety, grounding refs, safety, allowed operation and structural correctness.

Malformed AI output is not trusted.

### Usage Meter

Tracks requests, tokens/units, audio usage where relevant, estimated cost, quota, provider/model, capability and fallback.

Cost protection occurs before the provider call.

### Initial cost policy

Canonical defaults:

```text
paid_inference_enabled = false
monthly_paid_budget = 0
free_only = true
```

A billable provider MUST be rejected before the network call when paid AI is disabled.

Free quota exhaustion results in an approved free/local fallback or AI unavailable. It MUST NOT silently switch to paid inference.

### Provider neutrality

The architecture does not require OpenAI, Gemini, Groq, OpenRouter or any other specific vendor.

Absence of OpenAI API is not an architectural defect.

### Learner AI enablement order

Learner AI is OFF by default.

```text
global AI flag
    ->
capability flag
    ->
approved provider/model/data policy
    ->
learner setting / required consent
    ->
quota / budget
```

Failure at any step returns deterministic non-AI fallback.

### Admin modes

Canonical modes:

```text
Manual
AI Assist
AI Auto
```

AI Assist generates drafts/proposals/diffs/QA suggestions/media specifications/reports for human approval.

AI Auto is limited to allowlisted low-risk operations with capability ID, risk classification, target state, actor/service identity, policy version, before/after diff and audit record.

### Explicitly prohibited autonomous AI actions

AI Auto MUST NOT directly:

```text
publish content
rollback publication
delete/disable user account
change role
change MFA/security settings
change billing
increase AI budget
change privileged provider policy
override deterministic scoring
write mastery directly
```

### AI implementation dependency

Shared AI foundation is introduced in **P8** because Admin AI Assist requires it.

P8 includes:

- Gateway/Orchestrator;
- Policy Engine;
- Provider Router;
- provider adapter contract;
- at least one approved free/local adapter;
- Prompt Registry;
- Output Validator;
- Usage Meter;
- audit.

P9 reuses this foundation for learner AI and MUST NOT create a second AI stack.

---

## 2.4 Canonical skill–facet matrix and evidence mapping

### Global skills

Lingvessa has exactly six global mastery skills:

```text
Vocabulary
Grammar
Listening
Speaking
Writing
Pronunciation
```

No seventh mastery skill exists without explicit architecture revision.

### Reading

Reading is not a seventh mastery skill.

Reading tasks may generate item-level evidence relevant to Vocabulary and/or Grammar according to task objective.

An optional Level Test MAY expose `assessment_domain = reading` as an assessment-only subscore. It is not persisted as a seventh `skill_mastery_state`.

### Canonical facet registry

Only these machine codes are valid:

```text
recognition
meaning
recall_l2_to_l1
recall_l1_to_l2
production
spelling
orthography
listening_recognition
listening_gist
listening_detail
pronunciation_target
intelligibility
context_use
collocation
grammar_form
word_order
morphology
register
variant_awareness
interaction_repair
interaction_goal
```

### Canonical eligible skill–facet pairs

Vocabulary:

```text
recognition
meaning
recall_l2_to_l1
recall_l1_to_l2
production
spelling
context_use
collocation
variant_awareness
register
```

Grammar:

```text
grammar_form
morphology
word_order
register
context_use
```

Listening:

```text
listening_recognition
listening_gist
listening_detail
meaning
```

Speaking:

```text
production
context_use
register
interaction_repair
interaction_goal
intelligibility
```

Writing:

```text
production
spelling
orthography
grammar_form
context_use
register
```

Pronunciation:

```text
pronunciation_target
intelligibility
```

### Validation rule

Every `evidence_map` entry MUST validate the pair `(skill, facet)` against this canonical matrix. A facet attached to an unauthorized global skill is invalid even if the facet exists.

### Evidence semantics

Evidence describes what the learner actually demonstrated, not merely the topic of the exercise.

Ready-made phrase selection does not prove Speaking.

Typed role-play MAY contribute to Writing and explicitly mapped Grammar facets but MUST NOT produce Speaking evidence.

Spoken role-play MAY contribute to Speaking and Pronunciation only where usable learner audio and an appropriate evaluator exist.

Stress recognition is receptive evidence and normally maps to Listening, not Pronunciation.

### Mastery architecture

Item/facet state:

```text
language_profile
knowledge_item
facet
mastery_model_version
```

Global six-skill projections are derived from validated evidence.

Review scheduling operates primarily on:

```text
knowledge_item + facet
```

not on one global percentage.

---

# 3. СИСТЕМА UUID ТА ВЕРСІЙНОСТІ

## 3.1 Identity contract

### `id`

Type: `UUID`.

Purpose:

- database identity;
- API identity;
- foreign keys.

Rule:

```text
*_id fields contain UUID values
```

### `stable_code`

Type: `string`.

Purpose:

- stable human-readable semantic identifier;
- authoring;
- fixtures;
- debugging;
- content references before resolution.

Examples:

```text
E-A1-M01-L01
E-A1-M01-L01-A07
ENG_K_PRON_H
C-A1-M01
```

`stable_code` MUST NOT be stored in an `*_id` field.

### `version_code`

Type: `string`.

Purpose: immutable revision label for a versioned entity.

Examples:

```text
1.6
2026-09-05.1
```

Version changes do not change the semantic `stable_code`.

### Provider identifiers

External vendor IDs use explicit fields such as `provider_external_id`. They MUST NOT become Lingvessa canonical identity.

## 3.2 Authoring-to-runtime resolution

Content authoring MAY use stable codes. Before publication, build/import resolves them to UUID + stable_code + version_code.

Unresolved stable codes block publication.

## 3.3 Versioned system components

Behavior-affecting components retain concrete versions where required:

- content version;
- publication version;
- schema version;
- evaluator version;
- answer-policy version;
- mastery-model version;
- Review scheduler version;
- asset version;
- AI prompt version;
- AI policy version;
- AI provider/model version.

Historical attempts MUST NOT be silently reinterpreted under newer behavior.

## 3.4 Immutable evidence and publications

Published content is immutable. Modification creates a new version.

Rollback means changing the active publication pointer, not rewriting historical publication data.

Attempts/evidence remain tied to exact content/evaluator versions.

## 3.5 Current document baseline

This manifest declares the owner-locked implementation baseline:

```text
Lingvessa_Formal_Specification              v1.7
Lingvessa_Technical_Specification           v1.7
Lingvessa_Technical_Design                  v1.7
Lingvessa_Curriculum_Blueprint_A1           v1.6
Lingvessa_Reference_Module_Design            v1.6
Lingvessa_AI_Integration_Specification       v1.4
Lingvessa_Implementation_Plan                v1.4
00_project_manifest_and_constraints.md       current ADR/context authority
```

A stale predecessor version mentioned inside explanatory/history text is a documentation defect, not automatically an architecture BLOCKER, unless it changes actual normative behavior.

## 3.6 Precedence

```text
Formal Specification
    -> product scope and product-level invariants

Curriculum Blueprint
    -> A1 pedagogical/curriculum authority

Technical Specification
    -> normative technical requirements

Technical Design
    -> concrete implementation contracts

AI Integration Specification
    -> AI-specific policies and contracts

Reference Module Design
    -> executable English/Czech reference fixtures

Implementation Plan
    -> execution order

00_project_manifest_and_constraints.md
    -> architectural context, accepted decisions and audit constraints
```

If two governing documents contain a real semantic conflict: do not guess, do not silently choose, do not solve via implementation workaround. Require owner decision + ADR/spec revision + affected trace/test update.

## 3.7 MUST traceability

P0 creates the complete requirements trace matrix.

All normative MUST identifiers from the governing documents must be represented, including:

```text
Formal requirement IDs
Technical Specification requirement IDs
Technical Design requirement IDs
Curriculum CUR-A1-* MUST IDs
Reference REF-* MUST IDs
AI requirement IDs
AIA-01 ... AIA-16 acceptance requirements
```

Every MUST maps to at least one of:

```text
implementation backlog task
automated test
manual QA gate
ADR
owner decision
```

Canonical trace form:

```text
requirement_id
source_document
source_section
implementation_task
test_or_gate
status
exception_or_ADR
```

An implementation milestone cannot be declared complete while its release-blocking MUST requirements are untraced.

---

# 4. ПЛАН ВПРОВАДЖЕННЯ — P0–P13

`Lingvessa_Implementation_Plan` is the sole authority for P-number semantics.

P-numbers appearing historically in another document are descriptive only and MUST NOT redefine milestone order.

The project intentionally uses dependency gates rather than fixed calendar deadlines.

## P0 — Governance freeze

Purpose:

- lock exact document baseline;
- record architecture decisions;
- build complete MUST trace matrix;
- separate fixed decisions from genuinely open decisions.

Outputs:

```text
baseline record
decision log
requirement trace matrix
open-decision register
```

P1 is prohibited until P0 closes.

## P1 — Repository and engineering foundation

Includes:

- private Git repository;
- monorepo;
- package boundaries;
- TypeScript strict;
- CI;
- typed configuration;
- secret scanning;
- PostgreSQL bootstrap;
- initial migrations;
- synthetic English/Czech fixtures;
- container build;
- health/readiness endpoints.

There is no disposable one-folder prototype.

## P2 — Data, language isolation and publication foundation

Includes:

- users/sessions/roles;
- language profiles;
- UUID/stable_code/version_code;
- curriculum entities;
- knowledge entities;
- DB-level English/Czech isolation;
- content versions;
- publications;
- approvals;
- immutable manifests;
- schema validator.

## P3 — Lesson Engine and deterministic learning core

Includes:

- LessonPlayer lifecycle;
- activity registry;
- renderers/evaluators;
- correct-or-reveal;
- retry;
- assisted state;
- deterministic feedback;
- attempt idempotency;
- transactional evidence/outbox;
- lesson resume;
- remediation.

AI is not required in P3.

## P4 — Two-level Mastery, Review, mistakes and collections

Includes:

- immutable evidence;
- canonical facet validation;
- knowledge-item mastery;
- six global skill projections;
- Review schedules;
- due/weak/error prioritization;
- mistakes;
- remediation;
- reset behavior;
- personal collections.

## P5 — Media, audio and async speech

Includes:

- media requirements;
- assets and asset versions;
- object storage;
- original generated/programmatic images;
- audio scripts;
- normal/slow playback;
- multi-speaker dialogues;
- microphone UX;
- async speech-job lifecycle;
- pronunciation evidence.

Published media is pre-generated; live generation is not required for ordinary lesson execution.

## P6 — English reference module

Target: `E-A1-M01`.

Validate the first real vertical slice using the shared engine.

## P7 — Czech reference module

Target: `C-A1-M01`.

Prove the architecture is genuinely multilingual.

Czech MUST use the same Lesson Engine, activity schemas, attempt path, Mastery Engine, Review Engine, Media infrastructure and optional AI foundation.

A Czech-specific engine fork is prohibited.

## P8 — Admin/CMS + publication + shared AI foundation + Admin AI Assist

Includes:

- structured authoring;
- validation;
- linguistic/pedagogical review;
- media/accessibility/technical gates;
- preview;
- publication;
- rollback;
- coverage reports;
- audit.

Shared AI foundation is implemented here before real Admin AI Assist provider calls:

```text
AI Gateway/Orchestrator
Policy Engine
Provider Router
provider-neutral adapters
Prompt Registry
Output Validator
Usage Meter
AI audit
```

AI Auto remains OFF by default.

## P9 — Optional learner AI + low-risk AI Auto

Initial learner capabilities:

```text
Explain differently
bounded adaptive hints
extra practice
writing feedback
bounded text role-play
```

Learner AI requires opt-in, grounding, quotas and deterministic fallback.

P9 reuses the P8 AI foundation.

## P10 — Product surfaces and settings

Includes:

- Onboarding;
- Home;
- Explore/Course;
- Progress;
- Profile;
- Settings;
- notifications;
- quiet hours;
- timezone;
- DST-safe scheduling.

Settings include:

```text
target language
English variety
UI locale
Auto-advance
audio preferences
speech preferences
learner AI opt-in
reset lesson
reset module
reset all learning progress
account deletion controls
```

## P11 — Reference hardening and baseline freeze

Runs the full Reference regression suite plus technical acceptance, cross-language, responsive, accessibility, security, privacy, speech, AI, publication/rollback, migration, provider failure, queue/outbox, backup/restore and observability gates.

Reference baseline is frozen only after these gates pass.

## P12 — A1 M02–M12 rollout + pilot/calibration + optional Level Test

Includes:

- English M02–M12;
- Czech M02–M12;
- controlled content batches;
- original media generation;
- QA;
- publication;
- pilot data;
- Review calibration;
- speech false-negative monitoring;
- optional AI usefulness evaluation.

Reading MAY exist as a Level Test assessment subscore but remains outside the six global mastery skills.

## P13 — Full-system hardening and launch/no-launch gate

Includes:

- security;
- privacy;
- performance;
- load/capacity;
- migration;
- backup/restore;
- disaster recovery;
- release provenance;
- operational monitoring;
- legal/product readiness;
- production deployment decisions.

Outcome:

```text
all launch gates green
OR
explicit no-launch decision
```

P11 proves the architecture using reference fixtures. P13 proves the scaled product is operationally ready.

---

# 4.1 Intentional implementation compromises

The following are deliberate trade-offs and MUST NOT be reported as architectural defects merely because another approach exists.

## Modular monolith first

Chosen for fast iteration, enforceable module boundaries, simpler transactions and simpler deployment. Microservices require measured evidence.

## PWA before native applications

Chosen for one implementation path, responsive mobile/desktop use and lower initial maintenance cost.

## PostgreSQL relational model instead of graph database

Knowledge relationships form a logical graph, but PostgreSQL relational edges are sufficient for baseline requirements.

## Provider-agnostic AI

No AI vendor is a required dependency. Free/local-first is an economic/startup policy, not an architecture limitation.

## Paid AI disabled at baseline

Chosen to prevent accidental billing and allow evaluation of free/local providers.

## Pre-generated course media

Images/audio are generated during content production and QA, not live every time a learner opens an exercise.

## Reference modules before full A1

The hardest architecture contracts must be proven with real bilingual content before large-scale content production.

## English + Czech from the start

Czech is intentionally used as an architecture stress test for morphology, diacritics, register and pronunciation.

## AI after deterministic learning core

AI may improve teaching but does not define course correctness, learning-state persistence or publication authority.

---

# 5. AUDIT INSTRUCTIONS DERIVED FROM THIS ADR

When auditing Lingvessa documentation, distinguish:

```text
A. actual contradiction with this ADR
B. missing implementation detail
C. stale wording/version reference
D. alternative architectural preference
```

Only A or a genuinely release-blocking B should normally become a BLOCKER.

The following MUST NOT by themselves be reported as BLOCKER:

- not using OpenAI API;
- modular monolith instead of microservices;
- PostgreSQL instead of graph database;
- pre-generated media instead of live generation;
- AI remaining optional;
- paid AI budget being zero;
- Reading being assessment-only instead of a seventh mastery skill;
- manual level access despite prerequisite recommendations;
- PWA before native mobile apps;
- delaying bulk A1 until reference hardening;
- `speech_incorrect` being non-blocking;
- speech failure resolving as `speech_unavailable`;
- maintaining both `stable_code` and UUID;
- typed role-play without Speaking evidence;
- receptive pronunciation-related tasks mapping to Listening;
- requiring human authority for publication and privileged Admin actions.

An auditor SHOULD raise a BLOCKER when, for example:

```text
implementation permits cross-language DB lineage;
Speaking evidence is granted without speech;
an invalid skill–facet pair can pass publication;
AI can bypass authorization or directly modify mastery;
paid AI can execute while paid budget is zero;
duplicate speech callbacks can create duplicate evidence;
published content can be overwritten in place;
attempts/evidence cannot be replayed against original versions;
Czech requires an application-engine fork;
a P1+ implementation task starts before unresolved P0 architecture decisions are closed.
```

This manifest defines the intended architecture. Audit findings should test internal consistency and implementability against these decisions, not repeatedly reopen already approved architectural choices.
