# Media ingestion replay integrity

## Defect and correction

At parent `ec76bdaa8786c5e7625fcd572e0c5d37854edafe`, `MediaRepository.ingest` checked incoming length on every request. Initial ingestion also checked the incoming checksum through the storage adapter. A succeeded-job replay only matched metadata and verified the previously stored object, so changed incoming bytes of the same length were incorrectly accepted.

The repository now computes incoming SHA-256 immediately after validating the manifest and byte length, before database or storage access. A mismatch returns `ContractError` with code `INVALID_INPUT` and message `Asset checksum differs from manifest`. This shared check covers queued ingestion and succeeded-job replay. Existing storage verification, ownership checks and immutable metadata comparison remain in place.

## Regression and verification scope

The existing real-PostgreSQL gate `P5-MEDIA-JOB-001` in `tests/integration/p5-media.test.ts` now submits a valid SVG with one same-length color change under the original manifest. It requires rejection, compares all job/version/ingestion-audit rows with their earlier values, reads the original stored bytes, then verifies that a correct replay still returns the original result without extra attempts, versions or audit events. The gate remains one of the existing eight media gates, bound through `media-database-validation.json` in the 25-reference P5 acceptance report.

A bounded local harness executed the fetched repository class with explicit schema, database and storage stubs. The parent accepted the changed payload; the corrected source rejected it before any database query or storage read. Both allowed the valid replay and preserved state. TypeScript transformation accepted both edited source files. These are local reproduction/syntax checks, not full type checking or real PostgreSQL execution; the complete regression must pass hosted CI on the new source.

The parent passed all seven workflows, including P5 PR run 38258943462 and push run 38258938828. Their archive digests and all 25 acceptance references were independently verified. A parent PASS does not certify this correction. Final new-source run IDs and verified artifact digests belong in PR #5 metadata, without an evidence-only descendant commit.

P5 remains NOT_READY and PR #5 OPEN DRAFT. Human media QA, the 204 missing draft recordings, rights/cast decisions and publication gates remain open.
