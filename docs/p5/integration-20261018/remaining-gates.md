# Remaining P5 gates after real M01 execution

P5 IN PROGRESS / NOT READY. P0–P4 ACCEPTED. PR #5 OPEN DRAFT; no merge/P6.

Current continuation: [2026-10-22 transcript support and evidence](../integration-20261022/README.md). Parent 96cc960 passed seven workflows / eleven jobs, 450 declared test uses, real HTTP delivery and 90 independent artifact references. This batch needs its own exact-source verification.

The real input/import blocker is resolved on `460aab052115f6fe168d180b4ac44369afaab09d`: both runs, all seven workflows and all 78 acceptance references passed independent verification. [Evidence](verified-ci-460aab0.json). The approved ZIP is already private draft release asset `649769507`; reruns reuse it. No user ZIP, regeneration, public upload or Git media storage is needed.

| Severity | Remaining condition | Evidence needed / permitted next action |
| --- | --- | --- |
| BLOCKER | Required M01 reference media/publication gate | Resolve all required reference asset IDs through the appropriate publication manifest, with the retained audio and visual set decisions and completed activity-specific accessibility gates. The two disposable lesson publications prove storage/repository behavior, not complete course publication. Keep any preparatory work in P5; do not author P6 learner content. |
| BLOCKER | OD-004 production delivery profile | A recorded owner decision identifying the permitted production storage/delivery profile. Current testing uses disposable private S3-compatible storage; it does not select production hosting/CDN, introduce cost or close OD-004. |
| BLOCKER | OD-006 usable learner speech calibration | Valid labelled learner-error evidence and a versioned approved target-feature policy. The 402 acoustic reference recordings are not learner-error labels. Keep neutral `speech_unavailable` fallback; no new data collection, inference or provider adoption is implied. |
| IMPORTANT | Applicable compound clauses | Current trace 175 PASS / 30 PARTIAL / 151 PENDING; promote further rows only until each entire applicable clause has evidence. Separate P5 storage/playback/speech contracts from later P6/P8/P9 content/AI clauses. Do not start later phases to inflate P5 completion. |
| MINOR | Historical unreferenced blob receipts | 41 creation receipts are retained but binary retrievability cannot be revalidated through the connector; no dependency on them for the verified private archive/S3 route. |

The next technical action is exact-source verification of inline transcript audit/evidence handling, and the same-activity normal/slow publication guard, followed by the remaining P5 clause/applicability evidence review. Full reference-course activity authoring belongs to its separately authorized phase. Approved audio quality, six voices and rights remain final from 2026-10-14; the 30-item visual decision remains final for the exact presented set.

For interrupted CI: read `implementation/p5-media-speech` and its workflow runs first. Download and verify completed exact-HEAD evidence; retry only a failed required job when its cause is addressed. The workflow input chain independently checks the existing draft-release asset and runs `verify-m01-s3-import.ts --real-m01` using the documented development/test settings. Never repeat the old WAV-blob upload plan or the historical 204-file generation instructions.

Ordinary CI evidence artifacts expire on 2026-11-01 for the verified 460aab0 runs; their digest/reference/results records are retained in Git. One-day input relays are disposable. The original archive remains in the private draft release, which must not be published.
