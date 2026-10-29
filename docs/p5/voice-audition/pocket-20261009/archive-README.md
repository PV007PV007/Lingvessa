# Czech Pocket TTS audition — 2026-10-09

**Technical files PASS. Language/cast approval NOT GRANTED. Two new Czech candidates HOLD FOR REVIEW. P5 NOT READY.**

The bounded OD-005 experiment continues the existing authorization. Pocket TTS 3.3.0 and the Czech six-layer checkpoint ran locally on CPU, using only retained synthetic Piper English A (p225) and C (p228) as conditioning. These are corpus-derived Piper presets, **not** reference-free MOSS-designed voices. No uploaded human voice, learner data, cloud/paid inference, application dependency, provider activation or publication was used.

## Results

Expected Czech: **Dobrý den. Jak se jmenujete? Těší mě. Mluvím česky. Děkuji.**

| Trial | Normal | Slow (tempo 0.8) | Blind ASR edits / 10 words |
| --- | --- | --- | --- |
| Czech B, conditioned on synthetic EN A | [9.72 s](samples/cs-B-pocket-A-normal.wav) | [12.13 s](samples/cs-B-pocket-A-slow.wav) | 5 normal / 5 slow |
| Czech C, conditioned on synthetic EN C | [9.40 s](samples/cs-C-pocket-C-normal.wav) | [11.73 s](samples/cs-C-pocket-C-slow.wav) | 4 normal / 3 slow |

The first mode generated five utterances independently and joined them with 350 ms gaps. Ten unmodified float32 turn WAVs, seed values, final PCM16 gain, exact turn boundaries, authored M01 script UUIDs, reference hashes and output checksums are retained in `results.json`. Normal/slow output is mono PCM16 at 24 kHz with no clipped samples. Slow audio uses ffmpeg `atempo=0.8`; it is a tempo derivative of the same voice, not a purported extra speaker.

One targeted retry generated the complete text in a single call:

| Continuous retry | Audio | Blind ASR |
| --- | --- | --- |
| B | [3.76 s](continuous/cs-B-pocket-A-continuous.wav) | 4 edits / 10 words |
| C | [3.20 s](continuous/cs-C-pocket-C-continuous.wav) | 4 edits / 10 words; last two phrases absent from transcription |

This did not resolve the discrepancies. Neither new candidate is selected for M01/full generation. Missing text in ASR is a diagnostic signal, **not** a claim that a human listener confirmed an omission. Hearing the files and reviewing Czech consonants, first-syllable stress, vowel length, phrasing, naturalness and voice separation remain required.

## Independent diagnostic, with limits

`asr-screen.json`: pinned Systran/faster-whisper-small, CPU int8, beam 5, temperature 0, explicit language, no text prompt/hints, no VAD, no previous-text conditioning. NFC/case/word normalization ignores punctuation but preserves diacritics. All six prior English files match their 12 expected words. Prior Czech A has 1 normal / 2 slow edits out of 10. That control demonstrates that this ASR itself can misrecognize Czech; these numbers must not become production pronunciation scores or approval thresholds.

The PyAV file-decoder API initially failed before any transcription. `pocket-asr-screen.py` instead reads the known PCM16 WAV format with scipy and resamples to 16 kHz before passing the array to the supported ASR API. No application dependency or audit rule changed. `local-diagnostics.json` records this and the recovery boundary: earlier conversation reported failed Nano experiments, but their unavailable bytes/logs are not manufactured as evidence here.

## Reproduction and provenance

- `models.lock.json`: exact config and weights revisions plus hashes. Czech weights are approximately 438 MB; the measured synthesis process peak RSS was about 1.20 GiB.
- `tooling-lock.json` / `requirements-local.txt`: all 58 installed isolated package versions, distribution URLs and SHA-256 values. The TTS and ASR model weights are not shipped in the repository/delivery.
- `MODEL_CARD.md` / `czech.upstream.yaml`: retained upstream source. The only runtime configuration substitutions are the verified local weights/tokenizer paths; no architecture patch.
- `asr-model.lock.json`: exact diagnostic model revision and file hashes.
- `generation-output.jsonl`: actual per-turn execution. Continuous retry scripts/logs/results are retained under `continuous/`.
- Python socket connect/DNS audit hooks reject network access during model load, synthesis and ASR; all assets use local paths. ffmpeg processes only local WAVs.

To check the retained outputs without ML dependencies or model downloads:

```sh
python3 tools/p5/voice-audition.py --verify-only
python3 tools/p5/pocket-audition.py --verify-only
```

For a new independently reviewed reproduction batch, use the pinned isolated requirements and hash-verified model directories. `pocket-audition.py --models <tts-model-directory>` synthesizes; `pocket-asr-screen.py --models <asr-model-directory>` transcribes. Existing output bytes are immutable, so do not run generation over this retained batch. The two continuous diagnostic scripts accept `--repo <clean-working-copy>` and `--work <directory-with-model-and-asr-model>`. Cross-hardware bit identity is not asserted.

## Source and rights boundary

- [Kyutai Pocket TTS engine](https://github.com/kyutai-labs/pocket-tts): MIT engine licence claim, distinct from weights/voices/data.
- [vvolhejn Czech model card](https://huggingface.co/vvolhejn/pocket-tts-czech): CC BY 4.0 weights; derived from [ParCzech4Speech](https://huggingface.co/datasets/ufal/parczech4speech), ÚFAL / Charles University. The documented distribution is parliamentary speech; conversational limitations apply.
- Reference ancestry remains the prior Piper/VCTK model/data chain in `../README.md`, `../models.lock.json` and the retained model cards. Synthesizing a reference does not erase its provenance/licence obligations.

These are primary-source claims for an audition, not a completed legal/consent or production-cast review. OD-005 final cast/full generation remains OPEN. OD-004 delivery and OD-006 usable speech calibration are unchanged. Approved publication assets = 0. No phase requirement is promoted or waived by this experiment.
