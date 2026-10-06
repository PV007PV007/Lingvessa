# Lingvessa implementation state and handoff

Timestamp: 2026-10-06T05:02:49.781447+00:00
Phase: **P5 IN PROGRESS / NOT READY**. P0–P4 ACCEPTED; P6 NOT AUTHORIZED.
Branch: `implementation/p5-media-speech`. PR [#5](https://github.com/PV007PV007/Lingvessa/pull/5): OPEN DRAFT; do not merge.
Accepted main/P4: `5027f001237b6451237d87343ebeca58cd0af007`.
Latest directly inspected and artifact-verified full runtime PASS: `23257497db6cf29497f51d6e5b2476f97e3c7c43`.
P5 PR [run 37329468148](https://github.com/PV007PV007/Lingvessa/actions/runs/37329468148), job 111828570951; push run 37329449848, job 111828507205: all required steps succeeded. Separate P1–P4 hosted regression is green. Exact commands, job steps, artifact digests and summary: `docs/p5/evidence/ci-batch-012.json`.

## Exact-source evidence

The literal SHA above is the last observed run before this batch was committed. The revision carrying this file must pass its own hosted workflow: `tools/p5/acceptance-summary.ts` requires checked-out Git HEAD = GITHUB_HEAD_SHA = every runtime report's source. Its final result is `tested_sha` in hosted `artifacts/p5/acceptance-summary.json`, linked from PR Checks. A parent PASS or local synthetic checkpoint never certifies an untested descendant. The new audition verification must also pass on that revision; results are retained as `artifacts/p5/voice-audition-validation.json`.

## Batch and implementation state

IMP-P5-001 / 002 / 003 remain IN_PROGRESS. All 356 source rows retained: **174 PASS / 30 PARTIAL / 152 PENDING**. Existing requirement PASS rows retain their exact executed source evidence; audition evidence is supplemental on ten PARTIAL rows and promotes none to PASS. No compound or later-phase clause is waived.

The owner authorized the prepared bounded OD-005 local audition on 2026-10-05 (explicit “так”; `docs/p5/voice-audition/authorization.json`). Executed isolated CPU inference with Piper 1.8.0 and checksum-pinned models/dependencies: **eight WAV files, three English candidates plus one Czech candidate, normal/slow for each**. Text comes from ten project-authored M01 script records; UUIDs, source hash, model/speaker IDs, output checksums, durations, loudness and generation parameters are recorded in `docs/p5/voice-audition/results.json`. Actual PCM bytes are committed for listening, not registered as approved publication assets. Technical verification PASS; human linguistic/variety/voice quality review PENDING. Two Czech voices are still missing.

MOSS model metadata/source/model cards were inspected and pinned only; model weights/code were not run. The standard v1.5 BF16 weights alone exceed this workspace's 8 GiB memory cap. This resource result does not rule out other hardware or reviewed quantized/offloaded experiments. No paid API, learner data, uploaded real-person reference audio, final cast adoption or publication occurred.

**No contract change; no schema/API/migration/application dependency change in this batch.** Isolated authoring tooling and its CI byte/provenance validator were added. Existing phase schema/API details remain in `docs/p5/evidence/schema-api-diff.md`: only the two P5 migrations are unaccepted; all four accepted migrations and owner-locked sources remain unchanged. No P6/P7 runtime, P8 shared AI foundation or learner AI implementation was started.

Files added/modified/deleted: `docs/p5/evidence/changed-files.json` is the full phase inventory. This batch adds ci-batch-012, the audition script, eight WAVs and provenance/review records, and updates workflow, open-decision stage, owner inputs, task/trace/exit evidence and this handoff. No deletions.

## Exact executed validation

Prior exact hosted source: frozen install; baseline **76/76**; `pnpm check` (**54 unit + 4 smoke**); reference/flag checks; dependency audit **0 findings**; signed-S3 startup/restart/immutable byte/outage gates; PostgreSQL **18.6**, six migrations, clean DB/replay/seed/reseed/recreation/isolation; **16 integration tests**; **17 Chromium cases**; four OCI build/start/health/degraded/recovery gates. Zero test failures/skips. All seven hosted workflow runs green. Complete commands and actual job steps: ci-batch-012.json.

PR artifact 11354426744 SHA-256: `f26bfbf6c63edb73dc29c058b2e263dee9c4517747b382f1d68b444b0eb50844`; downloaded archive, 12 runtime report hashes and repository evidence hash independently verified. Runtime PASS; milestone NOT_READY.

This batch's local commands/results: `docs/p5/voice-audition/local-validation.json`. Generation used the isolated Python interpreter with `tools/p5/voice-audition.py --models <verified local model root>`; verification is `python3 tools/p5/voice-audition.py --verify-only` (8 samples, 4 model/text/speaker pairs, all byte/metric checks PASS). App baseline and diff checks are recorded there. No local PostgreSQL/OCI execution is claimed; the new source still requires its own real hosted regression.

## Remaining acceptance and owner decisions

Plan v1.4 §12 p7 requires **all M01 required asset IDs to resolve**. Prepared: 18 original SVG drafts, 12 flag drafts, 168 scripts / 420 audio slots and six voice profiles. Eight audition clips do not resolve that full asset set. Approved publication assets = 0; complete cast, provenance/rights clearance and human linguistic/semantic/accessibility/publication QA remain incomplete.

BLOCKER: no unresolved governing contradiction or failed runtime gate in the last verified source. IMPORTANT: complete actual M01 media, two remaining Czech voices, voice/provenance review and remaining requirement closure. MINOR: inherited Actions Node/Argon2id warnings and pg concurrent client.query deprecation; no current failed check. EXC-P1-001 retained: main is not technically protected; implementation branches, PR, green CI and owner review apply.

OD-004 delivery profile OPEN. OD-005 bounded audition authorized and executed, final tooling/cast/full generation approval OPEN. OD-006 remains required before usable real-provider speech evidence; unapproved evaluation stays neutral speech_unavailable. Paid inference=false; monthly paid budget=0. No production consent/licence/cast or human QA approval is inferred from successful synthesis.

Exact next task: verify this revision's hosted CI, deliver/listen to the four candidate normal/slow pairs and record language/variety/voice-fit review; complete the missing Czech candidate set before final cast/full generation decision. Resolve OD-004 before hosted delivery integration and OD-006 before enabling usable provider scoring. Keep PR #5 OPEN DRAFT; no merge and no P6.
