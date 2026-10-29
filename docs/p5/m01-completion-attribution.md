# M01 complete draft — source credits and processing

Original scripts: Lingvessa. All six working identities are synthetic project voices. The two Pocket conditioning clips are the existing generated Piper audition samples; no uploaded real-person reference was used.

| Component | Declared source / credit | Declared license |
| --- | --- | --- |
| English VCTK corpus | Junichi Yamagishi, Christophe Veaux, Kirsten MacDonald (2019), University of Edinburgh / CSTR, VCTK 0.92, DOI [10.7488/ds/2645](https://doi.org/10.7488/ds/2645) | CC BY 4.0 |
| Piper voices | [OHF-Voice/piper-voices](https://huggingface.co/OHF-Voice/piper-voices); English VCTK and Czech Jirka contributors identified in the retained model locks/cards | VCTK: CC BY 4.0; Jirka: CC0, as declared in model sources |
| Pocket TTS Czech | [vvolhejn/pocket-tts-czech](https://huggingface.co/vvolhejn/pocket-tts-czech), using Kyutai Pocket TTS | Weights: CC BY 4.0 |
| Czech training corpus | [ParCzech4Speech](https://huggingface.co/datasets/ufal/parczech4speech), ÚFAL, Charles University corpus authors | CC BY 4.0 |
| Diagnostic transcription | [Systran/faster-whisper-small](https://huggingface.co/Systran/faster-whisper-small), converted OpenAI Whisper, CTranslate2 / faster-whisper contributors | MIT declarations in retained locks/model cards |

Processing modifications: output resampled to 24 kHz mono PCM16, RMS/peak level adjustment, normal/slow pace pairs (FFmpeg `atempo=0.8`), and measured dialogue gaps. Conditioning references are synthesized English audition clips. None of the credits implies endorsement by model or corpus authors.

Pinned revisions, checksums, dependencies, seeds, texts, synthetic references and offline execution journals are retained alongside the audio. These source declarations and credits do not constitute a final legal/rights approval or permission to publish the resulting cast. The package is an unpublished working draft; human listening, final cast and publication decisions remain pending.
