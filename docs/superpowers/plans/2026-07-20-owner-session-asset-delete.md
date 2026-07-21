# Owner Session Stability and Asset Delete Implementation Plan

**Goal:** Prevent a signed-in Owner from being temporarily cached as a guest, and let an Owner delete an individual photo or video.

**Behavior:**
- A missing Clerk token is treated as a temporary loading error and retried.
- Owner status refetches on mount, focus, and reconnect.
- `DELETE /api/assets/:assetId` is Owner-only.
- Deleting a cover selects the next media item, or the previous item when deleting the last cover.
- Deleting the final media item deletes the containing Memory.
- D1 metadata and the matching R2 original are removed.
- The UI requires confirmation and updates React Query immediately.
- No D1 schema migration is required.

**Verification:**
- Targeted regression tests.
- Full TypeScript and Vitest checks.
- Production Worker and frontend builds.