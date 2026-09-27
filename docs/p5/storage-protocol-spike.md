# P5 storage protocol verification

The domain stores platform asset UUID/version/checksum and immutable object keys. S3 endpoint, bucket and signing credentials stay in the storage adapter. Required media are ingested ahead of publication; playback does not request generation.

The CI protocol gate builds and starts standalone MinIO from source commit `9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a` (release `RELEASE.2025-10-15T17-29-55Z`). This is an ephemeral loopback test process with random credentials and synthetic SVG bytes. It is not a Lingvessa runtime dependency, distributed application component, production provider choice or resolution of OD-004. No learner payload reaches a service.

The official project is archived. This fixed protocol fixture is not a recommendation to deploy it. Production storage/CDN selection and security review remain OD-004. CI records the source revision, actual binary hash and exact tested repository SHA. The test proves conditional immutable PUT, signed HEAD/GET, anonymous and wrong-credential rejection, checksum/size verification and restart recovery.

Sources checked 2026-09-27:

- https://github.com/minio/minio/releases/tag/RELEASE.2025-10-15T17-29-55Z (security fix and source build instructions).
- https://github.com/minio/minio/blob/RELEASE.2025-10-15T17-29-55Z/LICENSE (standalone AGPLv3 test server; no binary included in the application package).
- https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html (conditional `If-None-Match: *` semantics).

No hosted test result is assumed from this document. `artifacts/p5/storage-validation.json` is generated only after the actual gate succeeds.
