# P5 exit evidence

Status: IN PROGRESS / NOT READY for owner acceptance. PR #5 OPEN DRAFT; P6 not authorized.

Exact media/audio tested SHA: b3cac5d843b4a11b9b8e2d06b9e9495467cc1b6d. Hosted P5 run 36378454901/job 108788995230 passed install/baseline/check/references/audit, actual S3, PostgreSQL 18.6 bootstrap, 15 integration tests, EN/CS audio browser checks, OCI startup/degraded/recovery and P3/P4 regression summaries. Details: evidence/ci-batch-003.json. Synthetic tones/geometric assets are not linguistic QA or the M01 media library.

Current batch adds IMP-P5-003 speech server/schema/storage/worker/API and synthetic DB tests. Local 49 unit tests, lint, root type check and Prisma schema validation passed. Hosted speech server SHA `88413869b39cf9f91b36f41685148719e98124e6` failed at bootstrap/migration; no integration/OCI success is claimed. See evidence/ci-batch-004.json. The unaccepted P5 migration CASE-expression syntax is corrected; hosted PostgreSQL 18.6 rerun and microphone UI/browser acceptance remain pending. No new-batch runtime result is inferred from an earlier SHA.

Remaining P5 exit conditions: complete speech lifecycle/browser/failure/cleanup evidence; all required M01 asset IDs resolve with required provenance/QA; OD-004/005/006 closure where deployment/provider/calibration approval is required; all 356 phase trace rows evaluated against actual artifacts; final exact-SHA hosted full acceptance.

No governing specification change. First four accepted migrations unchanged. Paid inference false/budget zero. EXC-P1-001 remains: main is not technically protected. No automatic merge or P6 advancement.
