# P5 recovery, external bytes and development/test integration

Current continuation: [2026-10-20 owner visual acceptance and HTTP delivery](../integration-20261020/README.md). Real import/repository delivery has already passed on b9c34fa; historical missing-input statements below are recovery history. Reuse private draft release asset 649769507. No new ZIP or generation is required.

P5 **IN PROGRESS / NOT READY**. PR #5 remains OPEN DRAFT. P0–P4 accepted; no merge and no P6. Recovery baseline: `b53ef44ef6a8389b9680586817c101008e186027`, tree `09816f904b7637c8231664745464959a19645880`; accepted main `5027f001237b6451237d87343ebeca58cd0af007`.

## Interrupted blob operation

`recovery-state.json` and `historical-blob-receipts.json` retain the 41 successful blob receipts recovered from the interrupted operation. Each Git blob SHA was recalculated from the corresponding approved local WAV. The last recorded success was `AUD_ENG_M01_WORDS_BE_YOU.wav`, blob `6a6ac8898a12f846b4a04cef3154729ff49ab69d`. The remaining 379 entries in the 420-entry upload plan were only planned; there is no success receipt for them. No new commit/ref was created by that operation. The live baseline tree contains **zero M01 WAV files**.

The connector cannot decode binary blob responses, so current remote existence of the unreferenced blobs is **not revalidated**. Receipts are historical creation evidence, not a claim that the corpus was committed or is currently deliverable. No further audio Git blobs are created. No deletion/garbage collection of old objects is attempted.

## Approved corpus and acoustic coverage

The owner's 2026-10-14 linguistic, six-voice and audio-rights approval remains authoritative in `../m01-completion-20261014/owner-approval.json`. No generation, new cast decision or repeat approval is needed. Dataset SHA-256: `81b074a4c29dfa5a055aebadb43dfd6c37b48ba0e176fdc79f532e92323d1cdf`.

| Language | Final WAVs verified | Single-turn acoustic results | Dialogue WAVs outside pilot |
| --- | ---: | ---: | ---: |
| EN | 210 | 202 | 8 |
| CS | 210 | 200 | 10 |
| Total | 420 | 402 | 18 |

`external-m01-byte-validation.json` verifies all 35,876,788 WAV bytes against registry/record SHA-256, byte length, PCM format, frame cues, normal/slow relationships and six voice bindings. It also verifies the 30 actual SVG drafts. All 450 objects survive local-adapter recreation, exact replay and a changed-byte rejection. This evidence explicitly says PostgreSQL=false and S3=false.

The retained pilot plan, 14 result chunks and summary are under `../acoustic-provider/`. The plan binds each of its 402 entries to the approved final-file checksum. Silence, noise and tone controls are extra diagnostic inputs, not three more final files. Verifying retained results performs **no inference**. OD-006 remains OPEN: zero labelled learner recordings, insufficient family/voice coverage and no approved production policy. `local_acoustic_ipa` remains test-only and unavailable production speech stays neutral.

## PostgreSQL and S3 execution boundary

`tools/p5/verify-m01-s3-import.ts` requires explicit `--synthetic` or `--real-m01`; it never substitutes one mode for another. Both use a disposable PostgreSQL 18.6 database and the pinned standalone S3-compatible server, exercising importer replay, immutable SQL versions, byte tampering, private access, complete server/adapter restart and verified readback of all 450 objects. Synthetic mode additionally exercises EN/CS test publication pins and owner-scoped lesson delivery after restart. All synthetic approvals are labelled fixture-only. Real M01 import inserts no approvals or publications and does not load M01 course content. The 2026-10-16 follow-up adds a separate disposable test-publication stage using unchanged real WAVs; see ../integration-20261016/README.md for its explicit fixture-permission scope.

The editor runtime could not execute PostgreSQL: unprivileged-process escalation was automatically rejected. MinIO startup independently failed with `netlinkrib: operation not permitted`. These controls were not bypassed. Hosted CI runs the real PostgreSQL/S3 synthetic contract, and can run the same importer against approved M01 bytes when its external input is present. **A green synthetic run is not a successful M01 PostgreSQL import.**

`stage-m01-audio.py` verifies the exact approved ZIP (63,346,796 bytes, SHA-256 `3edaeaaeb000479921a0b3ff5ec2b52042faeee54bf943eff25e4a4a0f4e516d`) before extracting only the 420 allowlisted, independently checked WAVs outside the checkout. CI may receive a private HTTPS read URL through `P5_M01_AUDIO_ARCHIVE_URL`; neither URL nor credentials are committed or printed. Missing input emits `NOT_PROVIDED`, and acceptance reports `NOT_EXECUTED_EXTERNAL_INPUT_MISSING`, retaining NOT_READY. An invalid provided input fails the gate. The GitHub connector cannot configure this secret. The preferred 2026-10-16 transfer is an unpublished private GitHub release attachment, read with the existing ephemeral Actions token; see ../integration-20261016/README.md. No PAT, new access or storage account is required.

OD-004 remains OPEN. The standalone loopback S3 server is disposable development/test infrastructure, not a selected production provider, delivery profile, CDN, durability claim or paid service. Normal ingestion now accepts explicit S3 configuration under the existing local database guard, with external audio required and no automatic approval insertion. Any persistent bucket must be an already authorized development/test destination until OD-004 is resolved.

## Exact continuation

First fetch the branch and verify its actual HEAD and PR checks. The latest tested SHA and links belong in PR #5 and the exact-source workflow artifacts; parent green checks are historical only. Do not repeat the old audio-blob upload plan.

In an authorized development/test runtime with PostgreSQL 18.6 and the pinned MinIO binary, stage the already approved archive once:

```bash
python3 tools/p5/stage-m01-audio.py --archive /absolute/path/Lingvessa_M01_Complete_Audio_Draft_2026-10-14.zip --destination /absolute/path/outside-checkout/verified-m01
```

If that destination already exists, reuse it after byte verification; do not overwrite or regenerate it. The next repeatable integration command is:

```bash
node --import tsx tools/p5/prepare-m01-publication.ts
P5_M01_AUDIO_ROOT=/absolute/path/outside-checkout/verified-m01/audio MINIO_BINARY=/absolute/path/to/pinned/minio node --env-file=.local/runtime.env --import tsx tools/p5/verify-m01-s3-import.ts --real-m01
```

Each invocation creates and removes only its own disposable database and bucket directory; replay is asserted inside the run. Preserve `artifacts/p5/m01-library-import-validation.json` with its exact tested SHA and code bindings. This command does not choose a production delivery profile or authorize P6.

## Remaining work

- **BLOCKER (current):** real import is verified; complete required activity-specific reference-media publication/accessibility; resolve production delivery OD-004 and speech calibration OD-006 with proper evidence/owner decisions.
- **IMPORTANT:** remaining applicable compound P5 requirements retain their existing status; the separate 2026-10-20 owner decision accepts the exact 30 visuals without manufacturing per-file review forms.
- **MINOR:** current retrievability of the 41 unreferenced historical Git blobs cannot be established through the text-only connector; it is irrelevant to the new external-byte ingestion path.

Historical generation/partial-batch/failed-CI records remain intact. Current instructions no longer request the already completed 204 WAVs.
