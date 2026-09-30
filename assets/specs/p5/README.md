# P5 reference media preproduction

Source: locked Reference Module Design v1.6, sections recorded in the source catalog. This directory prepares media only; it does not implement or publish P6/P7 lessons.

`node --import tsx tools/p5/reference-media.ts --write` deterministically creates 18 original SVG drafts and the UUID/version/checksum catalog from `reference-media.source.json`. `--check` rejects drift, unresolved character/voice identity, unsafe SVG, invalid metadata and language/variety errors. `--require-ready` intentionally fails while media or QA is incomplete.

168 scripts expand to 420 normal/slow/turn/full-dialogue audio slots. They are scripts, **not audio files**. Six fictional adult voice profiles await OD-005 approval. Twelve national flag slots await verified geometry and rights records. No generated media bytes or QA approval are invented for these slots.

Original small code-native vectors may be tracked here; larger generated audio/raster bytes belong in platform-controlled immutable object storage with provenance/checksums. Registry is a draft, not a runtime publication manifest. `publication_ready=false` and `approved_assets=0` are deliberate. Rendering/technical review by the implementation agent does not substitute for the required human publication gates.
