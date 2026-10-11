# Czech held-out phrase check — 2026-10-10

**Executed bounded local experiment. Both voices HOLD_FOR_REVIEW; human listening PENDING. P5 NOT_READY.**

## Question and outcome

Does the case-normalization improvement generalize to five disjoint authored M01 Czech phrases?

All four matched comparisons tie at one word edit per thirteen expected words. The predeclared strict-improvement criterion is NOT MET. No further tuning or seed retries were performed. No normalization policy or voice is selected for production.

Expected authored text:

> Můžete to zopakovat, prosím? Jmenuji se Oksana. Odkud jste? Ona je učitelka. Nerozumím.

## Blind diagnostic ASR

| Voice | Pace | Control | Lowercase | Expected words |
| --- | --- | ---: | ---: | ---: |
| cs-B-pocket-A | normal | 1 | 1 | 13 |
| cs-B-pocket-A | slow | 1 | 1 | 13 |
| cs-C-pocket-C | normal | 1 | 1 | 13 |
| cs-C-pocket-C | slow | 1 | 1 | 13 |

Counts are Levenshtein edits after NFC/lowercase word tokenization, punctuation ignored and diacritics retained. No expected-text prompt, VAD or previous-text conditioning is used. ASR can misrecognize Czech and is not a human pronunciation judgment. Every generated condition is retained, including results that fail the hypothesis.

## Listen

| Candidate | Condition | Normal | Slow |
| --- | --- | --- | --- |
| cs-B-pocket-A | control | [Listen](samples/cs-B-pocket-A-control-normal.wav) | [Listen](samples/cs-B-pocket-A-control-slow.wav) |
| cs-B-pocket-A | lowercase | [Listen](samples/cs-B-pocket-A-lowercase-normal.wav) | [Listen](samples/cs-B-pocket-A-lowercase-slow.wav) |
| cs-C-pocket-C | control | [Listen](samples/cs-C-pocket-C-control-normal.wav) | [Listen](samples/cs-C-pocket-C-control-slow.wav) |
| cs-C-pocket-C | lowercase | [Listen](samples/cs-C-pocket-C-lowercase-normal.wav) | [Listen](samples/cs-C-pocket-C-lowercase-slow.wav) |

## Reproducibility and scope

`plan.json` was written before this batch's inference. SHA-256: `d948124d3de72a43eb00abca6e3653af0e8a1d59f518a870d5db0a1039accc10`. Two existing synthetic Piper EN A/C references, two text conditions and five phrases give exactly twenty generation attempts, zero retries/failures, twenty raw float32 turns and eight PCM16 normal/slow clips. The held-out phrase IDs are disjoint from the initial set. Candidate text is project-authored M01 source, not copied lesson material or learner data.

Pocket TTS 3.3.0, CPU torch 2.8.0+cpu, two compute threads, temperature 0.3, one sampler step, EOS threshold -4, copied voice state and paired fixed seeds. The control retains the engine's capitalization rule. The lowercase condition explicitly disables `capitalize_first_letter`, otherwise the engine silently restores uppercase. Token IDs and final prepared strings are retained for every turn. All other preprocessing remains unchanged. Four 350ms zero gaps separate the five raw turns; PCM peak is capped at 0.9 and slow playback is derived with ffmpeg atempo=0.8.

The unchanged pinned weights, tokenizer and ASR model are verified against [model/tool locks](../pocket-20261009/README.md). The [initial batch](../pocket-case-20261010/) retains all 58 hash-pinned dependency installation logs and the exact upstream YAML. Only model/tokenizer URLs are mapped to verified local files. Python socket connect/DNS is rejected during model loading and inference. No paid call, uploaded person's reference voice, application dependency, model-weight commit or production integration.

Actual generation: 17.49s; peak RSS 1247004 KiB. ASR is a fresh CPU int8 faster-whisper-small run; all eight new clips and six historical Czech anchors are screened. Complete transcripts and timing/log-probability diagnostics are in `asr-screen.json`; generation and ASR logs are retained. Generation/ASR source files are retained, unlike the recovered older batch.

Initial controls have the same frame lengths as historical controls but are not bit-identical (maximum PCM16 deltas B=4, C=55); no bitwise regeneration claim. Fresh ASR of unchanged historical C slow audio has four edits, compared with three in its archived screen. Old bytes and reports are immutable; this discrepancy is recorded, not overwritten.

Attribution: vvolhejn/Pocket TTS Czech, CC BY 4.0 weights; ParCzech4Speech corpus authors, ÚFAL / Charles University, CC BY 4.0. Pocket TTS engine Kyutai, MIT. Piper reference provenance and model/data licence claims remain in the original audition locks. Production rights/cast approval remains open.

## Verification

```sh
python3 tools/p5/pocket-case-holdout.py --verify-only
```

Stdlib-only verification is mandatory in P5 CI and binds checked-out SHA, source text, paired seeds, prepared text, hashes, PCM format/metrics/duration and all fourteen ASR input/result bindings. Inference runs only in the separate pinned local authoring environment, never CI. The current reports bind the exact generating/screening script hashes.

No requirement promotion: 174 PASS / 30 PARTIAL / 152 PENDING (356). Approved publication assets = 0. PR #5 remains OPEN DRAFT; no merge, full generation, publication or P6 approval. Next gate is human Czech listening/linguistic review; a consistent replacement needs a separate future experiment rather than selecting this result from ASR alone.
