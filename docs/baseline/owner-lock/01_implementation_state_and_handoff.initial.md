# 01_implementation_state_and_handoff.md

# Lingvessa — Implementation State and Handoff

**Purpose:** Single synchronization file between GPT-6 Astra Max (primary implementation model) and the project coordination/review chat.

## 1. Authority

- Architecture/context authority: `00_project_manifest_and_constraints.md`
- Product/technical/curriculum/AI governing documents: current approved Lingvessa baseline
- Execution authority: `Lingvessa_Implementation_Plan`
- Primary implementation model: **GPT-6 Astra Max**
- This file is operational state only. It MUST NOT silently redefine approved architecture.

## 2. Current baseline

- Formal Specification: v1.7
- Technical Specification: v1.7
- Technical Design: v1.7
- Curriculum Blueprint A1: v1.6
- Reference Module Design: v1.6
- AI Integration Specification: v1.4
- Implementation Plan: v1.4
- Project Manifest / ADR: current synchronized version

## 3. Current phase

**Current implementation phase:** P0 — Governance freeze / implementation readiness

**Owner lock:** completed 2026-09-10. P0 is authorized; P1 remains blocked until P0 exit evidence is accepted.

P1 MUST NOT begin until P0 exit evidence is complete.

## 4. Required Astra Max workflow

Before any implementation work, Astra Max MUST:

1. Read `00_project_manifest_and_constraints.md` first.
2. Read all seven current Lingvessa governing documents.
3. Treat approved architectural decisions as fixed unless a real contradiction or unsafe/unimplementable invariant is discovered.
4. Follow `Lingvessa_Implementation_Plan` as the sole authority for P0–P13 execution order.
5. Do not silently redesign architecture inside code.
6. For any behavior-changing architecture change:
   - stop;
   - record the conflict;
   - propose ADR/spec impact;
   - wait for owner decision before implementing the change.

## 5. Mandatory synchronization record after every coding batch

After every meaningful coding batch, Astra Max MUST update this file with:

### Batch metadata

- Date/time:
- Phase/milestone:
- Git branch:
- Commit SHA / PR:
- Task IDs / requirement IDs:

### Files changed

- Added:
- Modified:
- Deleted:

### Implemented

Concise list of completed behavior/contracts.

### Architecture decisions

List only new implementation decisions that do not contradict the approved ADR.

If none:

`No new architecture decision.`

### Migrations / schemas / APIs

Record all changes to:

- PostgreSQL schema/migrations
- OpenAPI
- JSON Schema
- activity contracts
- event contracts
- AI contracts
- speech contracts

If none:

`No contract change.`

### Tests executed

For each test command:

- command:
- result:
- relevant coverage/fixture:

### Acceptance evidence

List which milestone exit criteria / MUST requirements are now proven.

### Known issues

- BLOCKER:
- IMPORTANT:
- MINOR/technical debt:

### Open decisions

Only decisions that require product-owner or ADR approval.

If none:

`None.`

### Next exact task

One concrete next implementation step.

## 6. Synchronization rule for the coordination chat

The coordination/review chat MUST treat the newest version of this file plus the current repository diff/test evidence as the implementation state of record.

The coordination chat MUST NOT assume that work described in an older conversation is still current when a newer implementation-state file exists.

## 7. Required checkpoint package

At the end of each milestone P0–P13, Astra Max MUST provide:

1. updated `01_implementation_state_and_handoff.md`;
2. commit/PR identifier;
3. changed-file summary;
4. migration/schema/API diffs where relevant;
5. test commands and results;
6. milestone exit-evidence summary;
7. unresolved issues and owner decisions;
8. next milestone recommendation.

## 8. Initial state

Owner-locked documentation baseline is accepted. No implementation code is accepted yet; Astra Max must now execute P0 and produce the required exit evidence.

Next action:

**GPT-6 Astra Max reads the manifest and seven governing documents, performs P0 only, updates this file with P0 artifacts/evidence, and stops before P1 until P0 is owner-locked.**
