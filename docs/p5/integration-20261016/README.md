# Private M01 transfer and real integration continuation

P5 **IN PROGRESS / NOT READY**; PR #5 OPEN DRAFT. P0–P4 accepted; no merge and no P6.

## Verified input and prior execution

The newly attached `Lingvessa_M01_Complete_Audio_Draft_2026-10-14.zip` (including the browser-added `(1)` filename suffix) was read locally, not assumed available to GitHub Actions. It has 63,346,796 bytes and SHA-256 `3edaeaaeb000479921a0b3ff5ec2b52042faeee54bf943eff25e4a4a0f4e516d`. ZIP CRC and all 1,164 entries were checked. All 420 final WAVs match immutable record/registry SHA-256, lengths, PCM and frame counts, totaling 35,876,788 bytes. See `attached-archive-verification.json` for manifest bindings. This is byte evidence, not PostgreSQL/S3 execution.

| Language | Final files | Acoustic single-turn results | Dialogue files outside pilot |
| --- | ---: | ---: | ---: |
| EN | 210 | 202 | 8 |
| CS | 210 | 200 | 10 |
| Total | 420 | 402 | 18 |

The three diagnostic controls are not final corpus files. Owner approval dated 2026-10-14 still covers audio quality, the six voices and audio rights. No regeneration, repeat owner approval or changes to approved material occur.

`parent-ci.json` records all seven checks passing on `d7feb7d00cd4fc78ad7a16c58725b7ba29e98bdf`. That source executed PostgreSQL 18.6/S3 tests with 450 synthetic vectors and skipped real M01 input. It does not prove this descendant or a real M01 import. Current exact-HEAD evidence belongs in PR #5 and immutable Actions artifacts.

## Private transfer, outside Git

The existing P5 workflow prepares one idempotent **draft** release in the already private `PV007PV007/Lingvessa` repository, tag `p5-m01-private-input-20261014`, title `P5 private M01 input — DO NOT PUBLISH`. This is a temporary transport container, not a P5 code release or production storage architecture. Its target is the existing default branch; no default-branch change, published tag/release or P6 work is requested.

The isolated `p5-input-slot` and private upload bridge jobs have `contents: write`; application tests do not. It is restricted to the authorized branch or same-repository PR #5, checks repository privacy, reuses the matching draft, rejects an unrelated/published container, and never replaces or deletes assets. Checkout credentials are not persisted. It needs neither a PAT nor a new service/account.

The isolated input job uses its already scoped write token to read the private draft: an actual hosted read-only attempt returned HTTP 403. It verifies private repository/draft identity, downloads only the approved named asset, and checks its exact size/SHA-256. The main `p5-exit` job retains `contents: read`; it receives only this run's private Actions artifact by its exact ID, outside the checkout, and checks the source SHA, release identity and archive bytes again without any release token. The input relay is retained for one day; the ordinary 14-day evidence artifact excludes ZIP/WAV bytes. Authentication is sent only to the GitHub API; a signed GitHub asset redirect gets no Authorization header and cannot redirect again. URLs, tokens and response bodies are suppressed on error. Eight artificial-byte transport tests and six relay tests cover these boundaries; they are not M01 evidence.

The verified ZIP and extracted WAVs live outside the checkout on the disposable runner. Media is confined to the explicitly named private one-day input relay; no media is uploaded in the ordinary evidence artifacts or added to Git. `stage-m01-audio.py` independently checks the whole archive and each of the 420 files before setting `P5_M01_AUDIO_ROOT`. The existing private HTTPS Actions-secret input remains a supported alternative, not a requirement for this route.

The GitHub connector has no release-asset upload operation. Until the upload actually occurs, `m01-private-transfer.json` must say `AWAITING_PRIVATE_UPLOAD`, staging must say `NOT_PROVIDED`, and acceptance must say `NOT_EXECUTED_EXTERNAL_INPUT_MISSING`. Draft creation/read access is verified separately; neither counts as uploading the archive.

Current automatic transfer uses the existing GitHub connection and the private artifact bridge documented in [the 2026-10-17 continuation](../integration-20261017/README.md). The agent retains the approved ZIP; do not ask the owner to obtain or upload it again. Both accepted archive names remain supported; duplicate matching release assets fail closed. No token or signed capability belongs in Git, PR text or public storage.

After upload, inspect release asset metadata and rerun the exact current-HEAD `p5-input-slot` job with its dependent `p5-exit` job, so a fresh relay includes the uploaded archive. It rechecks input bytes and runs:

```bash
node --import tsx tools/p5/verify-external-m01.ts
MINIO_BINARY="$(go env GOPATH)/bin/minio" node --env-file=.local/runtime.env --import tsx tools/p5/verify-m01-s3-import.ts --real-m01
```

The first command reads the staged `P5_M01_AUDIO_ROOT`; no audio is generated. For a separately authorized local test runtime, the explicit staging and repeatable command in `../integration-20261015/README.md` remain valid.

## What the real gate must prove

The runner uses PostgreSQL 18.6 and a pinned S3-compatible server bound to loopback with a private bucket. It imports 420 audio + 30 visual draft versions, asserts exact replay and unchanged job/audit/version counts, rejects byte/metadata mutation and SQL update/delete, denies anonymous access, then closes/recreates the pool, server and adapter and checks every stored object. The importer itself must insert **zero approvals and zero publications**.

A subsequent, separate test stage creates two disposable EN/CS publications from existing P3 test content and immutable pins for the 420 imported WAVs. The permission rows are explicitly `DISPOSABLE_TEST_FIXTURE_ONLY`: they exercise the permission path and do not assert new human, visual or production approval. They do not overwrite the retained owner approval or approve the 30 SVG drafts. All 420 original WAVs must be returned byte-identically by `MediaRepository.bytesForRun` after restart; foreign users/activities and publication-pin mutations must be rejected. This is repository-level owner-scoped test delivery, not production HTTP/CDN delivery or pedagogical approval of M01 course content.

The real report must bind the exact source SHA and code hashes, `audio_assets=420`, `visual_drafts=30`, `test_publications=2`, `delivered_real_m01_audio_assets=420`, `import_inserted_approvals=0`, and `test_fixture_asset_approvals=2520`. Both publications and all fixture permissions disappear with the disposable database. No report is accepted if real mode was skipped; synthetic mode is explicitly separate.

The editor's previously observed PostgreSQL privilege rejection and MinIO `netlinkrib` restriction are not bypassed. Hosted execution is required here. No claim of actual import/delivery is made before the corresponding real report passes.

## Remaining gates and restart checkpoint

- **BLOCKER:** transfer the approved ZIP into the private Actions input and execute the real gate; complete visual quality/rights and required reference publication gates; resolve OD-004 production delivery and OD-006 labelled learner calibration with proper evidence/owner decisions.
- **IMPORTANT:** the 356 locked requirement rows retain their 174 PASS / 30 PARTIAL / 152 PENDING statuses. Local byte verification and test permissions do not close compound requirements or production QA.
- **MINOR:** the old 41 unreferenced Git blob receipts remain historical; text-only connector limitations prevent remote byte revalidation. The new path does not depend on them.

If interrupted: fetch branch HEAD, draft metadata, current-HEAD jobs and retained reports before acting. Reuse the draft and uploaded matching asset; never overwrite/re-upload blindly. The next idempotent action after upload is rerunning `p5-input-slot` and its dependent `p5-exit` on that exact HEAD. Rerunning only `p5-exit` would reuse the old missing-input relay and is insufficient. If no asset is present, follow the private bridge continuation; do not regenerate or execute the historical 420-blob upload plan. P5 remains NOT_READY, PR #5 remains draft, OD-004/OD-006 remain open, and P6 is not authorized.

## Exact false-positive remediation

The first hosted attempts at `5dd8ec6720e69a534c87ba8b686582ee69772ab6` failed the credential-URL detector before runtime tests. This was the artificial URL in the negative redirect test, not a real credential or an upload failure. The complete reviewed fixture is bound to SHA-256 `6136de229e691719b1cf63d8edc2c264007960545d7955ee1020ebf55c014a97` (Git blob `780657b0034437044e2caca6a187b99d751edab2`). Only that exact path/content/rule is classified as a known non-secret fixture; the scanner reports its classification for both working source and history. All other rules and the full reachable-history scan remain active. Tests prove that another path or any byte change cannot inherit it. No history rewrite or broad exclusion is used.

The private draft was created successfully before that failed gate: release ID `414560160`, unpublished, no uploaded assets when inspected. [Verified draft URL](https://github.com/PV007PV007/Lingvessa/releases/tag/untagged-5f0c6c85421eb1b84741). The read-only download step was skipped in those failed attempts, so they do not establish read access or actual input transfer.


## Read-only draft boundary observed

On `bdb2c7c2996de103ab680f59cd85d09b35f8918e`, all P1–P4 workflow checks passed, and both P5 jobs passed the complete source checks and eight transfer security tests. Their direct read-only draft request returned HTTP 403 before any import. No upload or real integration success is inferred. The correction keeps draft access in the existing isolated input job and relays data to the read-only test job through the private, one-day Actions artifact. No broader token is exposed to application tests. Current-head CI must verify the corrected relay.
