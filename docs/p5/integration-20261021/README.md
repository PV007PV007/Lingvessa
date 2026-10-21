# P5 declared media accessibility and requirement mapping — 2026-10-21

P5 IN PROGRESS / NOT READY. P0–P4 ACCEPTED. PR #5 remains OPEN DRAFT; no merge/P6.

## Verified baseline and retained approvals

Parent `d2ec78a5a5e61c1359a8e282abd47888bdd3f74d` passed seven workflows / eleven jobs. Both independently downloaded ordinary P5 artifacts passed CRC, exact-source/code binding and all 45 acceptance-reference checks each. [Retained evidence](verified-ci-d2ec78a.json). Real PostgreSQL 18.6 / private S3 tests imported, replayed and read all 450 versions after pool/server/adapter restart, then delivered their exact bytes through the authenticated HTTP API. Each run verified 420 WAV + 30 SVG responses, eight ranges, twenty negative responses including two storage-outage 503s, and two recovery reads. Parent execution does not prove this revision.

The 2026-10-14 owner approval covers quality, six voices and rights for all 420 WAVs. The 402 acoustic single-turn recordings (202 EN + 200 CS) and 18 dialogues (8 EN + 10 CS) make up the full 420 (210 per language). This is reference audio, not labelled learner-error calibration. The 2026-10-20 decision accepts the exact presented 30 visuals/descriptions/provenance. Both immutable approval records remain unchanged. No regeneration, repeated review request or new runtime owner identity is implied.

## Concrete publication defect and correction

Existing requirements already distinguish `semantic` and `decorative` use. The old publication check verified role, kind and variety but ignored that accessibility role. A valid, approved decorative vector could therefore fulfill a declared semantic requirement. The new additive migration checks every matching reference against its declaration, including optional roles when present, and rejects a missing required role. A matching semantic reference cannot mask a second mismatched reference with the same role.

Content validation and repository publication call the same PostgreSQL predicate; a publication trigger also rejects direct SQL attempts. `P5-MEDIA-A11Y-001` exercises decorative-for-semantic substitution, mixed matching/mismatched references, a mismatched optional role, direct SQL rejection, transaction rollback, a correct decorative use and an omitted optional use. Clean migration/replay/recreation now expect eight migrations. Prior migrations and approved bytes/metadata are unchanged.

The real M01 test declares 450 distinct **test uses** and verifies kind, variety and accessibility-role resolution before its two disposable publications. The existing exact-byte/replay/immutability/restart/HTTP checks remain mandatory. These declarations document test coverage; they do not assert that 225 assets pedagogically belong to a single real activity. The importer still inserts zero approvals/publications; 2,700 permission rows belong only to disposable fixture accounts.

## Clause-by-clause boundary

| Requirement | Verified evidence on d2ec78a | This revision / remaining evidence |
| --- | --- | --- |
| CUR-A1-015 — required media resolved before publication | 450 catalog/version bindings, transcripts and provenance; retained owner audio/visual decisions; 450 PostgreSQL pins and authenticated byte deliveries | Enforce each declared test use. Actual course/activity completeness belongs to the authorized reference-course phase; no learner-supplied assets or fabricated mapping. |
| AUD-001 — normal audio and quality slow playback | 210 exact normal/slow pairs, approved language/quality, all 420 bytes delivered; range/playback contract checks | Preserve pair checks. Actual selection against authored activity objectives remains a later course acceptance check. |
| AUD-005 — transcript/text alternative compatible with objective | Immutable transcripts, delivered metadata, transcript UI and support-audit tests | Declared visual accessibility checks do not prove objective-compatible transcript use. Real activity-specific accessibility review remains open; no new transcript policy is invented. |
| MED-001 — system supplies required lesson media | Private pre-generated corpus, repeatable ingestion and two test publications requiring no learner media input | Validate declared required/optional media roles; a complete authored lesson is not supplied by the synthetic P3 fixture. |
| REF-A1-010 — asset identity, QA and provenance/rights resolve before publication | All 450 immutable identities and retained decisions resolve; six technical fixture permission gates per version exercise publication access | Apply accessibility-role checks without converting fixture permissions into human/production approvals. Full reference publication remains a separate acceptance boundary. |

All five clauses remain PARTIAL; aggregate trace stays 174 PASS / 30 PARTIAL / 152 PENDING. This mapping clarifies evidence already obtained and work owned by later course phases; it does not waive an acceptance condition or authorize P6/P7. Current notes replace obsolete requests for missing audio/visual decisions while preserving their history.

## Exact-source execution and recovery

Use existing P5 Actions and private draft-release asset `649769507` (release `414560160`). The original 63,346,796-byte ZIP has SHA-256 `3edaeaaeb000479921a0b3ff5ec2b52042faeee54bf943eff25e4a4a0f4e516d`. It is already transferred and is verified before extracting the 420 allowlisted WAVs outside Git. Do not upload it again.

Read branch HEAD and existing runs before retrying. Verify all seven workflows / eleven jobs on the exact revision, then independently audit both P5 artifacts: 45 references per run, code/source hashes, all 450 pins, `required_test_uses_verified: 450`, actual HTTP counters and the new ninth media gate (28 runtime gates total). Synthetic mode cannot satisfy the real-M01 gate. Exact final results belong in PR #5 and source-bound artifacts; do not create an untested evidence-only descendant.

The existing manual commands in [the integration instructions](../integration-20261015/README.md) remain valid only in the permitted PostgreSQL 18.6 / pinned MinIO test environment. No production storage/CDN/TLS profile is selected. On interruption preserve HEAD, successful action, run/artifact IDs and use the idempotent read-only next command:

```text
GET /repos/PV007PV007/Lingvessa/actions/runs?head_sha=<verified branch HEAD>&per_page=100
```

## Remaining conditions

- BLOCKER: OD-004 owner production delivery profile decision; OD-006 valid labelled learner-error calibration and approved versioned speech policy. Neutral unavailable speech remains default. Neither decision is closed by this work.
- BLOCKER: applicable reference publication/accessibility acceptance remains unproven at full clause scope. P5 can enforce declared media contracts; authored M01 activities/objective review require their separately authorized phase.
- IMPORTANT: finish the compound-clause applicability/evidence review without promoting a whole clause from a technical subtest. Next review should examine transcript support and objective/evidence handling under the existing contract, without authoring P6 content.
- MINOR: 41 historical unreferenced Git blob receipts remain unverified through the binary-limited connector and are unnecessary for the verified private archive/S3 route.
