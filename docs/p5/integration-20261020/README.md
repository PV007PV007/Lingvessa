# P5 owner visual decision and real HTTP delivery — 2026-10-20

Current continuation: [2026-10-21 declared accessibility and clause mapping](../integration-20261021/README.md). Historical execution details below retain their original source scope.

P5 IN PROGRESS / NOT READY. P0–P4 ACCEPTED. PR #5 OPEN DRAFT; no merge or P6.

## Retained owner decision

The owner's “все добре. продовжуй” immediately follows delivery of the 30-item visual review and the request for review under ADR-D14. It is recorded as acceptance of that exact presented set, with this interpretation explicit in [owner-approval.json](../visual-approval-20261020/owner-approval.json). It binds the original b9c34fa manifest, HTML SHA-256 `ef54a4ab8897c6950e3672c7ebe96296f0aab4125ee11faf7a876ce35e33deaa`, all 30 version-2 metadata records and actual SVG bytes. No per-item form responses, independent legal opinion or authenticated runtime reviewer identity are invented.

The original records and worksheet retain their historical pending/draft labels. Current reports overlay the later decision. `ingested_review_status` describes those immutable historical records, while `owner_visual_approval` records current acceptance. The original HTML, SVGs, audio and metadata are unchanged. Changes to any accepted version, language, description, rights metadata, bytes or missing asset fail validation. Import creates zero runtime approvals; this decision does not approve production publication, select a delivery profile, close OD-004/006 or authorize P6.

The 2026-10-14 quality, six-voice and audio-rights approval remains final for 420 WAVs (210 EN + 210 CS). The 402 acoustic single-turn results (202 EN + 200 CS) plus 18 final dialogues (8 EN + 10 CS) account for the entire set. They are not labelled learner-error calibration.

## Actual delivery test

Parent `b9c34fa0c7513d824ee4aaede7e8bd31d297fe5f` passed seven workflows / eleven jobs, 450 real imports/replays/readbacks/repository deliveries, and two independent artifact audits with 86 acceptance references. [Retained evidence](verified-ci-b9c34fa.json). Those results do not prove the new HTTP checks.

`verify-m01-s3-import.ts --real-m01` now starts the actual Nest HTTP API against the recreated PostgreSQL pool and recovered private S3 storage. It logs in through the HTTP authentication endpoint using disposable fixture accounts and checks:

- Two owner-scoped EN/CS metadata lists, all 450 complete responses (420 audio + 30 visuals), exact bytes/checksums, MIME/length, private/no-store headers and SVG sandbox headers.
- Eight prefix/suffix ranges across normal and slow audio in both languages.
- Eighteen rejected anonymous/invalid-session/foreign-owner/wrong-activity/cross-language/stale-version/invalid-range requests.
- Two 503 responses while S3 is stopped, followed by two exact-byte recovery reads through the same running API after S3 restarts.

The existing importer/replay/immutability/server restart checks still execute against all 450 versions. Two disposable lesson publications and 2,700 explicitly fixture-only asset permission rows exercise the contract. No M01 pedagogical course or production publication is created. Synthetic mode explicitly reports the real HTTP gate unexecuted; it cannot substitute for real input. HTTP is loopback development/test; manually supplied Secure session cookies in this harness do not prove a production TLS/CDN profile.

## Execution and interruption recovery

Use the existing P5 Actions workflow and private draft-release asset `649769507`, release `414560160`. The original ZIP is 63,346,796 bytes, SHA-256 `3edaeaaeb000479921a0b3ff5ec2b52042faeee54bf943eff25e4a4a0f4e516d`. It is verified before extracting the 420 allowlisted WAVs outside Git. No upload, new service, payment, generation or repeated audio approval is needed.

Read branch `implementation/p5-media-speech` and its existing runs first. If running, continue observing; if complete, download the two ordinary P5 evidence artifacts and independently verify artifact digest/CRC, all **45 acceptance references per run**, source/code bindings, private transfer, 450 immutable publication pins, owner visual decision, and actual HTTP counters. Verify all seven workflows / eleven jobs on the exact new SHA. Do not reuse parent success or rerun completed work blindly.

In an already authorized PostgreSQL 18.6 and pinned MinIO test environment, using the existing outside-checkout staged audio root:

```bash
node --import tsx tools/p5/prepare-m01-publication.ts
P5_M01_AUDIO_ROOT=/absolute/path/outside-checkout/verified-m01/audio MINIO_BINARY=/absolute/path/to/pinned/minio node --env-file=.local/runtime.env --import tsx tools/p5/verify-m01-s3-import.ts --real-m01
```

Each run isolates and removes only its own test database/bucket directory. Preserve exact-source `m01-library-import-validation.json`, `m01-publication-bindings.json` and acceptance evidence. Record actual HEAD, last successful step, run/artifact IDs and next read-only status command on interruption. Exact final CI results belong in PR #5 and immutable artifacts, avoiding an untested evidence-only descendant.

## Remaining gates

**BLOCKER:** required activity-specific reference publication/accessibility; owner-selected OD-004 production storage/delivery profile; OD-006 valid labelled learner-error calibration and approved versioned speech policy. Neutral unavailable speech remains default.

**IMPORTANT:** remaining applicable compound clauses need complete evidence. Trace remains 174 PASS / 30 PARTIAL / 152 PENDING; this owner set decision does not promote an entire compound requirement or start later phases. The complete test publication is a contract fixture, not a P6 course.

**MINOR:** 41 historical unreferenced Git blob receipts cannot be revalidated through the binary-limited connector. They are unnecessary for the verified private archive/S3 route; do not upload or delete them again.
