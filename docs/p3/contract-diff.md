# P3 contract diff

P3 adds the `/api/v1/lesson-runs` start/resume/read surface, authoritative `/attempts`, and explicit `/exit` endpoint in `infra/contracts/p3.openapi.json`. The P2 endpoints remain compatible. Client-supplied score, correctness, mastery, ownership and version substitutions are rejected.

Migration `202609160001_p3_lesson_engine` adds pinned lesson runs/items, immutable attempts/receipts/raw evidence, and durable outbox/delivery state. Composite foreign keys bind user + language profile + language + publication + content version + item. Published content is still read from the immutable P2 projection. P4 mastery/review, P5 speech/media, and AI tables/endpoints are absent.

No governing specification, manifest, baseline checksum, or accepted P0–P2 migration was modified.
