# M01 publication bindings and visual review — 2026-10-19

P5 IN PROGRESS / NOT READY. P0–P4 ACCEPTED. PR #5 OPEN DRAFT. No merge or P6.

The previous exact HEAD `c55647e22d7ac1918db596ae2c4a398fee3b12bd` passed all seven workflows / eleven jobs; both P5 evidence archives were independently checked (78 acceptance references). [Retained evidence](verified-ci-c55647e.json). It proves 450 real imports/readbacks and 426 deliveries (420 audio + six avatars). This revision requires its own exact-HEAD CI and artifacts; parent success is not substituted.

## Current technical work

- `prepare-m01-publication.ts` resolves all 450 catalog UUID/stable-code/language identities to version 2: 420 approved audio and 30 unchanged visual drafts. It binds 210 normal/slow pairs and each voice/character/exact avatar dependency. Missing, cross-language or stale-version dependencies fail. This is a preparatory media manifest, not a pedagogical M01 course publication.
- `verify-m01-s3-import.ts --real-m01` now compares that plan with the independently verified real library, imports/replays all 450 versions, restarts PostgreSQL pool/S3 adapter/server, then exercises **all 450 deliveries** through two disposable test publications. The 30 visuals include six avatars. It records every actual PostgreSQL publication pin, byte checksum and canonical metadata checksum. Expected permission rows are 2,700 = 450 × six gates, exclusively in the disposable fixture; the importer inserts zero approvals/publications. Test permissions do not approve visual quality, accessibility or rights.
- `build-visual-review.py` packages the original 30 SVG byte streams and exact metadata into a self-contained HTML worksheet. It shows alt text, provenance, immutable version/checksum and assistant observations. The morning scene's low-sun cue and both “unclear” icons need semantic review. No existing asset is edited.
- Three browser checks decode/hash all 30 images, verify offline operation, mobile/keyboard access, denied local storage, export/import and rejection of mismatched hashes/versions/source or approval escalation. Notes, including complete “no comments” responses, remain `RECORDED_UNAPPROVED`; this file cannot authenticate a reviewer, create approval rows or publish.

## Repeatable execution

Use the existing P5 Actions workflow. It reuses private draft release asset `649769507` (63,346,796 bytes; SHA-256 `3edaeaaeb000479921a0b3ff5ec2b52042faeee54bf943eff25e4a4a0f4e516d`). No upload, new service, audio generation or repeated audio approval is needed.

In an already permitted PostgreSQL 18.6 / pinned MinIO test runtime, with the original external audio root staged according to [the recovery instructions](../integration-20261015/README.md):

```bash
node --import tsx tools/p5/prepare-m01-publication.ts
P5_M01_AUDIO_ROOT=/absolute/path/outside-checkout/verified-m01/audio MINIO_BINARY=/absolute/path/to/pinned/minio node --env-file=.local/runtime.env --import tsx tools/p5/verify-m01-s3-import.ts --real-m01
```

Read branch HEAD and its existing runs before rerunning anything. Download completed exact-source evidence and check its artifact digest, CRC, all 43 acceptance references, source/code hashes, 450 publication pins and real/synthetic scope. If CI is active, continue observing that run. If it failed, fix the specific cause before retrying. Keep private one-day input relays separate from ordinary review/evidence artifacts; do not publish the draft release or place WAVs in Git.

The generated worksheet is `artifacts/p5/Lingvessa_M01_Visual_Review_2026-10-19.html`; its source and SHA-256 are in `visual-review-manifest.json`. Exported JSON is review feedback, not authorization. An actual reviewer decision must subsequently be recorded against the exact asset version, bytes and metadata under ADR-D14 before any required publication gate can close.

## Remaining conditions

**BLOCKER:** complete approved reference-media publication/accessibility gate; OD-004 production delivery decision; OD-006 valid labelled learner-error calibration and approved versioned policy. Current storage/delivery proof is disposable development/test repository-level delivery, not production HTTP/CDN or course acceptance.

**IMPORTANT:** human semantic/accessibility/originality/rights review of 30 visual drafts and the two noted semantic issues; entire applicable compound clauses still need their own evidence. Trace remains 174 PASS / 30 PARTIAL / 152 PENDING. The 402 acoustic single-turn references (202 EN + 200 CS) plus 18 final dialogues (8 EN + 10 CS) account for the 420 approved WAVs; they are not a labelled learner-error corpus.

**MINOR:** 41 historical unreferenced Git blob receipts are retained; the connector cannot revalidate their binary retrieval. They are unnecessary for the verified private archive and S3 route. No deletion or random retries are authorized or needed.
