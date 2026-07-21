# Reliable Batch Upload Implementation Plan

**Goal:** Make mobile uploads of 10–20 photos resilient to temporary network failures and expired R2 upload links.

**Implementation:**
- Extend R2 presigned URL lifetime from 5 minutes to 30 minutes.
- Upload no more than 3 files concurrently.
- Retry each failed file up to 3 times with 1s, 2s, and 4s delays.
- Refresh authorization when R2 returns 401 or 403.
- Retry upload-authorization requests.
- Preserve every successfully uploaded file in page state.
- A second Save attempt uploads only failed or incomplete files.
- Require a valid Clerk token for every authenticated API request.
- Display per-file upload status and a filename-specific error.
- No D1 schema migration is required.

**Verification:**
- Retry behavior tests.
- Reauthorization tests.
- Concurrency limit tests.
- Resume-without-reupload tests.
- Thirty-minute TTL test.
- Full TypeScript, Vitest, Worker build, and frontend build.