# P5 private transfer through the existing GitHub connection

P5 IN PROGRESS / NOT READY. PR #5 remains OPEN DRAFT. No merge or P6. The owner requested autonomous transfer through the existing GitHub connection; the retained approved archive is available to the agent. The owner does not need to obtain another ZIP or repeat the 2026-10-14 audio quality, cast or rights approval.

## Input and evidence boundary

`private-transfer-plan.json` fixes the approved archive name, 63,346,796-byte length and SHA-256 `3edaeaaeb000479921a0b3ff5ec2b52042faeee54bf943eff25e4a4a0f4e516d`. The outer transport ZIP contains exactly that unchanged archive and has its own length/checksum. No media is added to Git. All 420 final WAVs already matched immutable record/registry checksums and PCM/frame counts in `../integration-20261016/attached-archive-verification.json`. The 402 acoustic results cover 202 EN + 200 CS single-turn files; 18 final dialogue files (8 EN + 10 CS) are outside that pilot, also byte-verified. Three diagnostic controls are not corpus files.

Parent `c0f10126db2da1506d377ce34476988f877fe2c8` passed seven workflows. Both P5 artifacts and all 74 referenced checksums were independently verified. Its actual M01 run was **NOT_EXECUTED_EXTERNAL_INPUT_MISSING**. `parent-ci.json` preserves that historical evidence, not a claim about this descendant.

## Private bridge

The serial `p5-private-bridge` job runs only on the authorized branch or same-repository PR #5. It checks repository privacy and the identity of existing unpublished release `414560160`, with the existing restricted `contents: write` token. A matching uploaded asset is reused; subsequent download verifies the actual bytes. Conflicting metadata is an error. No overwrite, deletion, publication or new release is performed.

If input is absent, a custom Node 24 action creates one private artifact upload session using the v4 wire format of `@actions/artifact` 2.3.2 (the SDK in the pinned official upload action). It exposes only the service-issued, short-lived **single-blob** upload capability in a private one-day control artifact. The runtime token and GitHub token stay inside the runner. The control artifact must never be copied to Git, public storage, PR text or logs. The external agent downloads it using the existing GitHub connector, validates exact source/repository/archive/envelope identity, then PUTs the envelope without a GitHub Authorization header or redirects.

After HTTP 201, the agent saves a receipt and creates a small unreferenced Git **text** blob containing the exact upload acknowledgement. It contains run/source/checksum/nonce metadata only. The action polls that exact blob SHA for up to 12 minutes, finalizes the artifact, downloads it without GitHub credentials, checks envelope size/SHA and its sole safe ZIP entry, and verifies the original approved archive again. It attaches those unchanged bytes to the existing **private draft**. The following isolated input job independently downloads the release asset and verifies it, relaying it to the read-only test job through the existing one-day input artifact.

This is temporary private transfer within existing GitHub Actions, not production media storage. PostgreSQL/S3 development/test remains the approved execution architecture; OD-004 does not authorize a production delivery profile. The ordinary evidence artifact excludes WAV/input ZIP bytes. Existing audio and privacy authorization does not authorize real learner calibration, production credentials, payment or P6.

## Idempotent continuation

1. Fetch branch HEAD, the draft's assets, exact-source workflow jobs and artifact list. Never reuse a control artifact from another run/source or after expiry. If a matching release asset exists, rerun the bridge/input job chain; it will reuse that asset.
2. If the current bridge is waiting, download its `p5-private-upload-control-<run>-<attempt>` artifact privately. Extract only `private-upload-control.json` to a mode-0700 directory outside Git. Do not print its contents.
3. Reproduce/reuse the checksum-bound envelope with `python3 tools/p5/private-m01-envelope.py pack <approved-zip> <envelope-zip>`.
4. Run `python3 tools/p5/private-m01-envelope.py upload <private-control-json> <envelope-zip> --head <exact-head> --receipt <private-receipt-json>`. A matching saved HTTP-201 receipt avoids re-upload. If interrupted before a receipt exists, inspect remote/run state rather than blindly retrying. No ambiguous success is reported.
5. Through the existing connector, create only the UTF-8 text blob from `<private-receipt>.ack.txt` and check its returned SHA against the receipt. This exact operation is idempotent. It does not update a branch or trigger extra CI.
6. Observe `PRIVATE_ARCHIVE_ATTACHED`, then independently inspect asset metadata and real report. A timeout/failed PUT/finalization never counts as upload or real integration success. Rerun the bridge job on the same source if its session expired; inspect existing release assets first.

The existing real command is `MINIO_BINARY="$(go env GOPATH)/bin/minio" node --env-file=.local/runtime.env --import tsx tools/p5/verify-m01-s3-import.ts --real-m01`, after authenticated input staging as specified in the 2026-10-15 integration instructions. Required actual evidence: 420 audio + 30 SVG draft versions; idempotent replay; immutable row/byte rejection; private object access; storage process/adapter/database-pool restart; 450 readbacks; two disposable test publications with all 420 original audio deliveries; wrong user/activity and immutable pin rejection. The 2,520 permission rows are explicitly disposable test fixtures, not new owner/visual/production approvals. Import inserts zero approvals/publications.

## Remaining gates

The current source's CI/artifacts and PR #5 are the authority for this transfer attempt and real execution; no pending operation is marked PASS here. Real-input success must bind exact HEAD and every acceptance-artifact checksum. P5 remains NOT_READY while visual QA/reference publication, OD-004 production delivery, OD-006 labelled learner calibration and applicable compound clauses remain open. Existing trace statuses are not upgraded merely by creating a transport route. Historical generation/review records remain historical; do not regenerate the already completed 204 WAVs or any approved audio.
