# P5 resumed Actions and private-input boundary — 2026-10-26

P5 remains **IN PROGRESS / NOT READY**. P0–P4 remain ACCEPTED; PR #5 stays OPEN DRAFT. No merge or P6.

## Observed execution

The owner requested another attempt after changing GitHub settings. Run [39811276331, attempt 3](https://github.com/PV007PV007/Lingvessa/actions/runs/39811276331/attempts/3) executed on 2026-10-25 at exact source `875461ca57f72928815014806773ec34751459a1`. Runners were assigned. This supersedes the earlier before-job-step failure for that attempt; it does not establish that private-repository billing or Actions availability is repaired.

The repository API reported `private=false` on 2026-10-25 and again on 2026-10-26. The private bridge failed during preflight, and its input job was skipped. The sanitized log does not reveal the exact failing assertion. Independently, the unchanged bridge and transfer code require a private repository, so the observed public state is incompatible with the approved transfer design. No real M01 import ran in this attempt. [Exact failed-attempt evidence](ci-875461c-attempt3.json).

The separate `p5-exit` job passed installation, baseline validation, Prisma generation/validation, peer checks, lint, full typecheck and dependency boundaries, then failed the secret scan. A deliberately invalid credential URL in a mocked transport test matched the scanner. The fixture had changed to add pinned-release/asset checks, but only its previous exact checksum had been reviewed.

## Correction and bounded verification

The complete current fixture was reviewed. The scanner now recognizes its exact SHA-256 as well as the earlier historical version, only at the original test path and only for the `credential-url` rule. No path-wide or rule-wide exclusion is introduced. Tests compute the real current Git blob identity and reject changed bytes, another path and an added credential. [Local checks and source bindings](local-security-checks.json).

Local results use Node 24.22.1; hosted CI remains pinned to Node 24.19.0 and pnpm 11.19.0. Focused unit/transport/relay tests, changed-file lint/typecheck and governance validation do not establish full-project or real PostgreSQL/S3 acceptance. The fresh recovery copy has no generated Prisma client; full project validation is delegated to the exact-commit hosted workflow. The preceding 875461c hosted generation and typecheck passed.

The recovery copy was reconstructed from the saved 2026-10-25 export. Its ZIP SHA-256 and CRC passed, and all 835 repository files matched their recorded Git blob identities before editing. No audio, approval, manifest, migration, workflow or private-transfer code is changed by this correction.

## Private input and continuation

Existing release **414560160** remains an unpublished draft; asset **649769507** is uploaded, 63,346,796 bytes, digest `3edaeaaeb000479921a0b3ff5ec2b52042faeee54bf943eff25e4a4a0f4e516d`. Reuse it. Do not create another release, upload again, publish the archive, put WAVs in Git or remove privacy checks. Owner approval dated 2026-10-14 still covers all 420 final WAVs, six voices, quality and rights. The 402 single-turn acoustic results plus 18 dialogue files account for all 420 final files; they do not prove learner-error calibration.

The approved private test context must be restored before private-media transfer can run. The current connector can read visibility but cannot change it. A public-code/private-media replacement design would require a separate explicit review; it is not silently substituted here. PC/VM migration remains deferred by the owner. No new paid service is introduced.

After restoring the approved private context, read the branch ref and current Actions attempts before doing anything. If the exact current-source P5 run has failed only because of this condition, rerun its failed jobs once using the existing release/asset. Record new run attempt, runner/job IDs and results. Do not rerun the old 875461c source after a successor is published. If private Actions is again blocked before steps, retain the error and stop retrying that unchanged condition.

The current source needs **seven workflows / eleven jobs**, **31 runtime gates** (3 storage + 9 media + 7 audio + 12 speech), both real M01 runs and independent artifact audits. Real execution remains `node --env-file=.local/runtime.env --import tsx tools/p5/verify-m01-s3-import.ts --real-m01` under the existing [integration procedure](../integration-20261015/README.md). It must verify actual 420 WAV + 30 SVG import/replay, immutable versions, restart/readback and HTTP delivery; synthetic fixtures cannot replace it.

Last full verified execution remains `96cc9607c3a05481dddd9f8e6c763d8241db26eb`, not this correction. Exact successor results are recorded in PR #5 so a documentation-only commit does not falsely inherit its parent's CI.

## Remaining gates

- BLOCKER: approved private runtime context and current-source CI/real M01 evidence; OD-004 production delivery profile; OD-006 labelled learner-error calibration/target policy; applicable full reference publication/objective accessibility.
- IMPORTANT: remaining P5 atomic/compound applicability and evidence review. Trace remains 175 PASS / 30 PARTIAL / 151 PENDING; no requirement status is promoted by this correction.
- MINOR: unused empty draft 420910401 remains unpublished/untouched; 41 historical unreferenced blob receipts remain unnecessary for the approved archive/S3 route.

Production delivery is not selected while OD-004 is open. Development/test storage and delivery remain the permitted scope. OD-004 and OD-006 are not closed by runner availability, owner audio approval or passing synthetic tests.
