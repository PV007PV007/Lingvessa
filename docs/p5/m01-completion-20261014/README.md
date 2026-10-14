# M01 complete audio draft — 2026-10-14

**All 420 final files are present: 210 English and 210 Czech.** This closes the 204-file generation gap. Automatic technical verification and blind ASR are complete. Human listening and final cast/rights/publication decisions remain pending; PR #5 remains a draft and P6 is not authorized.

## What changed

The exact locked PyTorch URL returned HTTP 200. All 67 files (58 wheels, four synthesis-model files and five primary ASR-model files) passed their existing SHA-256 locks. The 58-package Python 3.12 environment was installed offline with `--no-index --require-hashes --no-deps`; `pip check` passed. No application dependency or locked generation setting changed.

The 2026-10-13 temporary completion run and its uncommitted source did not survive workspace restoration. GitHub and saved artifacts were checked before reconstruction; no current evidence is inferred from those lost bytes. `reconstruction-plan.json` was written before this new generation and covers all 97 missing Pocket turns without quality-based selection. Each turn has one synthesis attempt in this reconstruction. This is not a claim that no earlier lost synthesis ever happened or that reconstruction is bit-identical.

The unchanged generator produced 97 raw, 97 normal and 97 slow WAVs under native Linux seccomp network denial. Three original per-turn journals remained STARTED despite complete raw/processed files. `processing-recovery.json` preserves their hashes and proves that both processed outputs exactly match re-derivation from the raw file using the locked processing/model/tokenizer. Original journals remain unchanged; synthesis was not repeated and no completion time is invented. A stale assembly marker is similarly retained with an explicit full-PCM checkpoint.

The assembler preserves the 216 original final files byte-for-byte and adds 204 files, including dialogues composed of retained Piper and new Pocket turns. Local verification checked all 532 original WAVs, all 291 continuation WAVs and every one of the 420 final PCM streams and cue boundaries. All final audio is mono PCM16 at 24 kHz, non-silent and without digital clipping. These are technical checks, not a claim of natural pronunciation or perceptual quality.

## Quality findings

The primary locked small ASR model screened all 204 new files with no expected-text prompt. There are **134 new discrepancy flags**, plus 109 retained flags, **243 / 420 total**. All original screens are preserved. Both languages and both speeds remain available for listening. No ASR or human review is silently promoted into approval.

A separately pinned medium ASR model screened **all ten full Czech dialogue files**, selected before inference, with the same blind decoding settings. It found **26 word edits across 160 reference words**, compared with 67 in the small model on the same files. This is a supplemental comparison within the same Whisper model family, not independent human evidence. One dialogue pace has no medium-model discrepancy; this does not establish pronunciation correctness.

Highest-priority listening targets are the repeated “Dobrý den” rendered as “Dobý den” in several transcripts, “Jmenuji se Klára” / “Jmenuj se Klara”, and “Děkuji” / “Díkuj”. The informal dialogue is substantially closer to the authored text. Names, numbers, very short words and spelling variants can inflate automatic edit counts. The accompanying quality report retains both transcripts and exact asset hashes so a reviewer can determine whether each is an audio fault or an ASR error. **No human listened attestation has been filled in.**

## Reproduction

Use the original immutable plan and locks under `docs/p5/m01-audio-draft-20261011` and `docs/p5/voice-audition/pocket-20261009`. Acquire and verify dependencies before offline inference. All commands run from the repository root; paths below refer to separate working directories. Do not rerun synthesis over existing output.

```bash
python3 tools/p5/continue-m01-audio.py plan --audio-root PARENT --output SELECTION.json
AUTHORING_PYTHON tools/p5/m01-audio-draft.py generate --engine pocket --models POCKET_MODELS --output POCKET_RUN
# Only if a completed run has stale STARTED records with all three files:
AUTHORING_PYTHON tools/p5/recover-m01-pocket-journal.py --models POCKET_MODELS --output POCKET_RUN
python3 tools/p5/continue-m01-audio.py assemble --audio-root PARENT --continuation-root POCKET_RUN --output COMPLETE
AUTHORING_PYTHON tools/p5/complete-m01-audio.py screen --output COMPLETE --audio-root PARENT --continuation-root POCKET_RUN --models ASR_MODELS
# A stale assembly marker requires the explicit --recover-assembly-marker switch;
# all 420 PCM streams and cues must match before a checkpoint can be accepted.
python3 tools/p5/complete-m01-audio.py retain --output COMPLETE --audio-root PARENT --continuation-root POCKET_RUN --run-root RUN
AUTHORING_PYTHON tools/p5/crosscheck-m01-dialogues.py run --audio COMPLETE --models MEDIUM_MODELS
python3 tools/p5/complete-m01-audio.py metadata --report metadata.json
python3 tools/p5/crosscheck-m01-dialogues.py verify --report dialogues.json
python3 tests/unit/p5-m01-completion.test.py --report tests.json
python3 tools/p5/complete-m01-audio.py deliver --output COMPLETE --audio-root PARENT --continuation-root POCKET_RUN --destination NEW_DELIVERY
python3 tools/p5/validate-m01-feedback.py --complete-batch --input NOTES.json --output NEW_PRIVATE_REPORT.json
```

Environment: `PYTHONDONTWRITEBYTECODE=1 HF_HUB_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2`. Both inference commands install the native offline guard before importing model libraries. ASR also disables ONNX telemetry.

`results.json` binds the new record shards, generation/screening journals, recovery proofs and exact executed source hashes. The larger model and selection have separate locks; `dialogue-crosscheck.json` binds their plan and executed source. `delivery.json` identifies the final audio ZIP and complete offline reviewer; the earlier partial ZIP and HTML are unchanged. Source credits and processing notices are in [the attribution record](../m01-completion-attribution.md).

## Verification scope

Twelve continuation tests cover immutable assembly and recovery-proof rejection. Three completion tests cover the 420-file six-voice catalog, mutated identity/audio/ASR/seed rejection, and the complete feedback CLI with artificial pending notes and forged progress. The ten existing feedback tests still pass; no actual human feedback is introduced. CI adds three hash-bound reports, bringing P5 acceptance references to 30.

Hosted CI verifies retained metadata only and explicitly reports zero external WAVs verified. Browser regression uses the established audition fixtures. Local Chromium headless-shell installation again failed with an invalid download archive, so no local full-M01 browser playback is claimed. The delivered HTML is separately checked for all 420 embedded byte hashes, PCM durations/cues and JavaScript syntax. Exact-source CI results belong in PR metadata and immutable workflow artifacts, not in an evidence-only descendant commit.
