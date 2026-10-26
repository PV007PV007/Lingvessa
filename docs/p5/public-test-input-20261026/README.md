# P5 public repository and approved final-audio test input

P5 **IN PROGRESS / NOT READY**. P0–P4 ACCEPTED; PR #5 OPEN DRAFT; no merge or P6.

The owner requires a no-new-paid-service route and clarified on 2026-10-26 that the audio need not be private. [Recorded scope](owner-scope.json) permits the 420 approved, unchanged final WAVs in a one-day Actions test-input artifact. It does not publish the original archive, historical/intermediate files, private review records or a production release. Quality, six voices and rights approval from 2026-10-14 remains effective. No regeneration or new owner review is required.

Standard GitHub-hosted runners for public repositories are free under the [GitHub billing documentation](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions). This workflow keeps `ubuntu-24.04`, existing ephemeral Actions credentials and one-day input retention. No subscription, larger runner, paid storage account, PC access or new secret is introduced.

## Transfer and credential boundary

1. The trusted P5 branch or same-repository PR #5 checks the exact event/checkout SHA and owner scope. The isolated preflight job reads the existing pinned draft input and verifies that anonymous requests to the original release, asset API and download route return 404. Other responses fail closed. It does not create, publish, replace or retarget a release.
2. The isolated input job independently repeats preflight, downloads the original into a private temporary directory, checks its approved SHA-256/size, and extracts only the 420 allowlisted final WAVs. Every WAV is checked against the source manifest, immutable asset record, PCM format and frame count. The original temporary ZIP is removed before artifact upload.
3. The public test-input artifact contains exactly 420 WAVs, a source/run/attempt-bound receipt and the retained source attribution with the current approval context. An extra archive, intermediate file, symlink, modified credit or changed WAV fails validation. There are no original archive locators, review Library identifiers or private original-archive digests in the receipt. Retention is one day.
4. The test job has `contents: read`, receives only that same-run artifact, and independently checks the complete file set, all checksums, immutable records and receipt code bindings. It never receives a release-write token. Missing or altered real input still fails acceptance; no synthetic substitution is allowed.
5. Existing real M01 commands then exercise the disposable PostgreSQL/S3 runtime and authenticated loopback HTTP delivery. The public test-input artifact is transient CI transport, not Git media storage, a CDN or a chosen production storage/delivery profile. OD-004 and OD-006 remain OPEN.

The original private-repository route is retained for an explicitly private repository; its guards are not relaxed. Public runs cannot call the old plaintext whole-archive relay. GitHub [draft-release access](https://docs.github.com/en/rest/releases/releases) is checked at runtime, not merely assumed from documentation.

## Byte verification and actual execution

[Local byte verification](local-byte-verification.json) independently restored the retained original and passed its SHA-256 and ZIP CRC. It contains 1,164 entries, including 1,027 WAV entries: 420 final files and 607 historical/intermediate files. Only the final 35,876,788 WAV bytes are eligible for transfer. This local check is not PostgreSQL/S3 execution.

| Language | Final WAVs | Single-turn acoustic results | Dialogues outside that pilot |
| --- | ---: | ---: | ---: |
| EN | 210 | 202 | 8 |
| CS | 210 | 200 | 10 |
| Total | 420 | 402 | 18 |

The retained 402 acoustic entries match the corresponding final-file checksums. The 18 dialogue files complete the final corpus; synthetic diagnostic controls are not additional final assets. This does not establish learner-error calibration.

The exact previous HEAD `6debfb91eb6373be08d46b6ea07ff39bba37fd0c` passed five P1–P4 workflows, the production audit and 31/31 technical runtime gates in both P5 exit jobs, but both P5 workflows failed the old private-input condition. Neither real M01 execution occurred there. This new transfer needs its own exact-source seven workflows / eleven jobs, both real M01 PostgreSQL/S3/HTTP runs and independently checked artifacts. Final results belong in PR #5 and the linked immutable run artifacts; do not attribute a parent's result to a descendant.

Required real command remains `MINIO_BINARY=<pinned-binary> node --env-file=.local/runtime.env --import tsx tools/p5/verify-m01-s3-import.ts --real-m01` after the receiver sets the external `P5_M01_AUDIO_ROOT`. Import/replay, immutable versions, rejected byte changes, full storage server/adapter restart, 450 byte readbacks and authenticated delivery must actually pass.

## Idempotent continuation

Read branch HEAD, PR state and latest Actions attempts first. If this revision is already running, inspect it; do not create a replacement input, upload the original again or rerun older commits. On a failed input job, inspect its safe error and current draft state; do not retry unchanged failures. Rerunning the appropriate failed workflow jobs creates a new run-attempt-bound final-WAV artifact from the same original. Expired one-day input requires rerunning the input job for the current attempt, not bypassing the receiver. Record every attempt and verify both P5 events before promoting exact-source runtime evidence.

Restoring repository Private is no longer a prerequisite under the owner's new final-audio scope. Earlier restore-Private instructions are historical. All 356 requirement rows remain 175 PASS / 30 PARTIAL / 151 PENDING until requirement-specific evidence justifies a change. BLOCKER: actual new-source M01/CI evidence, OD-004, OD-006 and full applicable reference publication/objective accessibility. IMPORTANT: remaining clause applicability/evidence review. MINOR: retained historical cleanup. No merge/P6.
