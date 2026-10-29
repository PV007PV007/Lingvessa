# P5 reference media preproduction

Source: locked Reference Module Design v1.6; sections recorded in the source catalog. This prepares media only; it does not implement or publish P6/P7 lessons.

`python3 tools/p5/normalize-flags.py --check` verifies pinned upstream SVG hashes and reproducible static normalization. `node --import tsx tools/p5/reference-media.ts --check` validates the 18 original SVG drafts, 12 flag drafts (7 country geometries), UUID/version/checksum catalog and language/variety/voice identities. `--write` regenerates derived drafts; `--require-ready` intentionally fails while media/QA is incomplete.

168 scripts expand to 420 normal/slow/turn/full-dialogue audio slots. They are scripts, **not audio files**. Opaque `turn_id` UUIDs remain the same across normal/slow and individual/full-dialogue versions. The six fictional adult voices and all 420 final M01 WAVs were owner-approved on 2026-10-14; this older preproduction registry remains a draft. Do not regenerate or re-request approval of the approved audio. `flags/provenance.json` and the upstream README retain pinned source/rights claims; these do not assert human publication approval. Normalization removes only local SVG references/clipping; the runtime SVG security allowlist is unchanged. Chromium source-versus-normalized pixel comparisons are the geometry gate.

Small static vector drafts are tracked here; larger audio/raster bytes belong in immutable platform object storage with provenance/checksums. Registry is a draft, not a runtime publication manifest. `publication_ready=false` and `approved_assets=0` remain explicit. Technical rendering/structural validation does not replace semantic, linguistic, accessibility and rights review.
