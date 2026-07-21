# Phase 2A Photo Upload Foundation

This checkpoint implements the reusable foundation required by the confirmed
Phase 2 plan:

- pure-photo versus legacy-video selection
- 100-photo selection limit
- resume fingerprints
- full-file SHA-256 Web Worker
- local-to-Session matching
- typed Upload Session API client
- 20-file authorization batches
- concurrency 3 and retry 3 through the existing reliable uploader
- per-file server progress recording
- active Session React Query hooks
- reusable photo Session state hook
- bounded wrapping preview grid and statistics

Studio, Add Photos, and Review routes are intentionally deferred to Phase 2B.