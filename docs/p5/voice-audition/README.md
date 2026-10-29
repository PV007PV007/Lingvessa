# OD-005 local voice audition — original 2026-10-06 batch

Update 2026-10-10: [the retained Czech Pocket TTS batch](pocket-20261009/README.md) adds two Czech candidates, normal/slow pairs and continuous diagnostics. Both candidates remain **HOLD_FOR_REVIEW** after ASR discrepancies; final cast, human listening and P5 acceptance remain pending. The eight original Piper files below are unchanged.

Owner authorized this bounded experiment on 2026-10-05; see `authorization.json`. **Eight candidate WAV files were actually synthesized locally on CPU.** The technical file/provenance checks pass. Human listening review, final character binding, full voice-cast acceptance and production/publication approval remain pending. This is not the M01 publication asset registry and does not close P5.

| Candidate | Preset / exact speaker ID | Normal | Slow |
| --- | --- | --- | --- |
| English A | VCTK p225 / 107 | [WAV](samples/en-A-p225-normal.wav) | [WAV](samples/en-A-p225-slow.wav) |
| English B | VCTK p226 / 95 | [WAV](samples/en-B-p226-normal.wav) | [WAV](samples/en-B-p226-slow.wav) |
| English C | VCTK p228 / 90 | [WAV](samples/en-C-p228-normal.wav) | [WAV](samples/en-C-p228-slow.wav) |
| Czech A | jirka / 0 | [WAV](samples/cs-A-jirka-normal.wav) | [WAV](samples/cs-A-jirka-slow.wav) |

English text: “Hello. Good morning. What's your name? Nice to meet you. Thank you.”

Czech text: “Dobrý den. Jak se jmenujete? Těší mě. Mluvím česky. Děkuji.”

These texts are concatenated from the existing project-authored M01 script records; `results.json` retains their UUIDs, source/text hashes and language. Candidate names do not bind a preset to Maya/Daniel/Alex or Klára/Adam/Oksana. This Piper Czech model supplies **one** preset; the later Pocket batch adds two audition candidates, without establishing an approved Czech cast. No pitch-shift substitutes were created.

## What was executed

Piper 1.8.0 in an isolated Python 3.12 environment, ONNX Runtime CPU, hash-verified model/config files at a fixed Hugging Face revision. Synthesis uses only local paths and a Python audit hook rejects socket connect/DNS during generation. No learner data, uploaded person reference voice, hosted inference, paid inference, database changes, provider routing or P8 AI runtime were used. No Piper/TTS dependency was added to the application runtime. A separate subsequent security correction updates two existing transitive application packages; see `../evidence/dependency-patch-validation.json`.

Each file is mono PCM16 / 22,050 Hz. Measured duration, RMS/peak dBFS, integrated LUFS, generation time and SHA-256 are in `results.json`. Seed and synthesis parameters are pinned; exact cross-hardware bit reproduction is not asserted. Retained output bytes are immutable. A subsequent audition uses a new reviewed batch rather than overwriting these files.

Reproduce with the pinned models in the directory structure from `models.lock.json`, in a new working copy without existing audition WAVs:

```sh
python3 -m venv /tmp/lingvessa-p5-audition
/tmp/lingvessa-p5-audition/bin/python -m pip install --only-binary=:all: --require-hashes -r docs/p5/voice-audition/requirements-local.txt
/tmp/lingvessa-p5-audition/bin/python tools/p5/voice-audition.py --models /path/to/verified/piper-models
python3 tools/p5/voice-audition.py --verify-only
```

The existing WAVs can be verified without installing Piper or downloading any model. The required hosted P5 workflow runs this validation. Listening to a candidate does not approve it for publication.

## Tool/model provenance and licence boundaries

- Engine: OHF-Voice/piper1-gpl v1.8.0, commit `639388b6317fc4731e91d53da42aea68fd4166ff`, upstream GPL-3.0. Used as isolated authoring tooling; engine binaries and model weights are not shipped in this audition package. Exact wheel/dependency SHA-256 records: `tooling-lock.json` and `requirements-local.txt`.
- Model repository: `rhasspy/piper-voices`, revision `c10ece1aade47bb51c153c893d14e5bf8e5b7117`. The model cards are retained as `en-vctk-MODEL_CARD.md` and `cs-jirka-MODEL_CARD.md`; their checksums and weight/config checksums are in `models.lock.json`.
- VCTK dataset attribution/source: [CSTR VCTK Corpus at the University of Edinburgh](https://datashare.ed.ac.uk/handle/10283/3443); the model card identifies CC BY 4.0 dataset terms and fine-tuning from US lessac. These are candidate presets learned from the documented corpus, not newly designed MOSS voices or a declaration of complete production consent/licence clearance.
- Czech model card identifies the [OHF voice dataset](https://github.com/OHF-Voice/voice-datasets), CC0 dataset terms and lessac fine-tuning. Repository-level licence labels are not substituted for per-model/data provenance.
- Full rights/variety/voice-cast review remains open under OD-005. No claim of original human voice ownership or endorsed identity is made.

MOSS alternative: metadata was pinned and inspected, but no MOSS model weights were downloaded and no model code was executed. Local Transformer v1.5's BF16 weights alone are 9,100,859,544 bytes, exceeding the current 8 GiB memory limit before codec/runtime memory. `resource-assessment.json` records the exact revisions and sizes. This rejects the standard unquantized local path in this environment, not all possible future hardware/quantized/offloaded experiments.

## Listening checklist and remaining work

Review each normal/slow pair for script completeness, naturalness, clicks/noise, pace and preserved voice identity. English additionally needs en-GB variety/intonation review; Czech needs first-syllable stress, vowel length, diacritics and natural phrasing. Confirm whether a candidate fits the intended adult character role only after listening. Technical measurements cannot approve these linguistic/semantic criteria.

OD-005 audition authorization is fulfilled as a bounded experiment. The later Pocket batch fills the two additional Czech audition labels, but final cast approval remains OPEN and those candidates are held for review. OD-004 delivery selection and OD-006 real speech-evaluator calibration are unchanged. P5 NOT READY; PR #5 stays open; no P6.
