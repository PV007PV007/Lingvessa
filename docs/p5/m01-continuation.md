# Historical M01 continuation procedure (completed 2026-10-14)

This document records the former partial-batch procedure. All 420 final WAVs now exist and are owner-approved; **do not run generation or assembly again**. Current next steps are [external-byte ingestion and integration](integration-20261015/README.md). Historical commands and observations below are retained for reproducibility, not future work.

The retained authoring script generates the Pocket turns into a fresh directory, but its original assembler expects the pre-export Piper journals and refuses an already assembled batch. The delivered archive retains the WAVs; authoritative turn journals are in the repository. Re-running the original assembly against either directory alone cannot complete the mixed Piper/Pocket dialogues.

`tools/p5/continue-m01-audio.py` closes that assembly gap without changing the historical, hash-bound scripts or evidence. It never loads a model, synthesizes, runs ASR or accesses the network. The working cast, authored text, seeds, processing, dependency locks and publication registry are unchanged.

## Plan

From the repository root, validate the extracted, unchanged v2 archive and write a new plan outside the audio directory:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 tools/p5/continue-m01-audio.py plan \
  --audio-root /absolute/path/to/extracted-v2 \
  --output /absolute/path/to/new-continuation-plan.json
```

This verifies all 532 parent WAVs, exact dialogue PCM/timing and the authoritative metadata. It selects only **97 unattempted Pocket turns / 204 absent Czech assets**, with their existing text, voice, seed and asset identities. It binds all **216 retained final files** to their original hashes. No already attempted turn can enter the continuation. An existing output file or a path inside the audio inputs is rejected.

CI uses `plan --metadata-only` and explicitly reports zero external WAVs verified. That report must not be substituted for the full local byte check.

## Generate, then assemble

At the time, generation was blocked until the exact locked Pocket environment and model files are available. The pinned PyTorch wheel returned HTTP 403 during the 2026-10-13 availability check. No replacement, alternate access path, paid call or new voice choice is introduced here.

The historical recovery used the **unchanged** generator in the restored environment with a fresh output directory:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 tools/p5/m01-audio-draft.py generate \
  --engine pocket --models /absolute/path/to/pinned-pocket-models \
  --output /absolute/path/to/new-pocket-run
```

The generator installs its existing kernel network guard before native imports and preserves the original one-attempt rule. Do not retry a started/failed run or delete its journal. An interruption requires an explicit, separately scoped recovery; the new assembler rejects incomplete runs.

After all 97 turns succeeded, assembly used another new directory outside the repository and both input directories:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 tools/p5/continue-m01-audio.py assemble \
  --audio-root /absolute/path/to/extracted-v2 \
  --continuation-root /absolute/path/to/new-pocket-run \
  --output /absolute/path/to/new-complete-draft
```

Before writing, the command verifies the entire parent, complete generation journal, exact attempt inventory, package/model/reference/guard bindings, text/voice/seed identity, raw and processed hashes and measured audio properties. It rejects retries, extra attempts, symlinks and escaped paths. It copies the 216 old final WAVs byte-for-byte and assembles only the 204 absent files from verified old/new turns. Normal/slow dialogue gaps and cue offsets use the original processing plan. No input file is modified.

`assembly.json` records all 420 files, parent and continuation provenance, copied parent ASR records, and **204 pending new ASR screens**. It retains every existing approval gate. An interrupted assembly retains `INCOMPLETE.json` and cannot overwrite an existing output directory on rerun. Keep the original archive and new generation directory: their raw and intermediate evidence is not duplicated in the final-audio directory.

The original change only prepared assembly. The subsequent 2026-10-14 completion and owner-approval records supersede its missing-file and pending linguistic/rights statements. Do not reuse the historical fixed-216 exporter to replace its retained batch.

## Verification

Eleven stdlib tests use explicitly synthetic tones and temporary journals, with no model imports or inference. They verify the real metadata selection, complete and incomplete journal handling, modified bytes/text/seed/cast/provenance rejection, duplicate/extra attempts, path/link containment, exact PCM joins and frame/ms timing for both speeds, byte-identical copying, exclusive private outputs and interruption markers. Synthetic fixture journals are not retained as real generation evidence. Assembly and its end-to-end synthetic test require `ffmpeg` with the `ebur128` filter for measured loudness; CI installs the Ubuntu package explicitly before those tests, with bounded package-network waits.

Local checks restored the original 22,169,837-byte ZIP with SHA-256 `ba5467c06504160a6bf3f6b29433bc99d037eb68183e607d610a254ae95d45f0`, verified all 532 WAVs and produced the full-byte continuation plan. All eleven tests passed. This was a source subset verified against parent `69a0cf64a9ae4a22a6ebcb0084ca9a2c734c74af`, not a local full-project or real-Pocket generation run.

CI runs those tests and the metadata-only plan, and binds both reports into the P5 acceptance summary (27 total artifact references). Full hosted results must belong to the resulting commit; a parent PASS is insufficient. P5 stays NOT_READY, PR #5 OPEN DRAFT, with no publication, merge or P6.
