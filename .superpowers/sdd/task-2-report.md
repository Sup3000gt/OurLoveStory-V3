# Task 2 Report: Public Timeline Assembly

Status: DONE

## Files

- `worker/lib/timeline.ts` — public D1 timeline assembly and deterministic cover selector.
- `worker/lib/timeline.test.ts` — Miniflare + D1 coverage for visibility, covers, ordering, URLs, deep-link IDs, and fallback tie-breaking.

## Commit

- `3b132143ce44a9c2578a5985dead30894d34d9ff` — `feat: assemble public memory timeline`

## TDD evidence

### RED

Exact command:

```text
npm.cmd exec vitest run worker/lib/timeline.test.ts
```

Result: FAIL during test collection as expected because `worker/lib/timeline.ts` did not exist. Vitest reported `Cannot find module './timeline' imported from 'D:/Downloads/OurLoveStory-V3/worker/lib/timeline.test.ts'`.

### GREEN — focused suite

Exact command:

```text
npm.cmd exec vitest run worker/lib/timeline.test.ts
```

Result: PASS — 1 test file passed and 2 tests passed.

### GREEN — specified regression suite

Exact command:

```text
npm.cmd exec vitest run worker/lib/timeline.test.ts worker/lib/memories.pagination.test.ts
```

Result: PASS — 2 test files passed and 5 tests passed.

## Self-review against the Task 2 brief

- Created only `worker/lib/timeline.ts` and `worker/lib/timeline.test.ts` for the implementation commit; no routes, client/page files, or unrelated Worker code changed.
- The D1-backed fixtures include published memories in two 2026 months, multiple July public images, a private image, a video, a draft memory, valid explicit year/month covers, and a once-valid August cover whose asset is made private.
- Tests assert years and months are newest-first, each visible group resolves one cover, valid explicit covers win, invalid explicit covers fall back, and deterministic fallback uses the documented ordering.
- The public query permits only published memories and public image assets. The explicit-cover query applies the same published/public/image restrictions and verifies the cover asset belongs to the joined memory.
- The implementation groups dates by ISO `YYYY` and `YYYY-MM`, returns nested years and months with asset-based `photoCount`, and does not select empty periods.
- `selectTimelineCover` is a pure exported helper with deterministic ordering: memory date descending, memory creation time descending, asset sort order ascending, then asset ID ascending. It does not use randomness, current time, or storage order.
- Tests assert private, draft, video, and invalid-private explicit cover assets do not appear; the response maps only derivative `/api/assets/:assetId/preview` and `/thumbnail` URLs and preserves `memoryId` and `assetId` for detail deep links.
- SQL selects no original asset URL or object key, so public timeline result mapping does not expose original URLs.
- No push or deployment was performed.

## Concerns

- None. Vitest automatically selected inspector port 9230 because 9229 was unavailable; both requested test commands completed successfully.

## Review Fix

### Files changed

- `worker/lib/timeline.test.ts` — replaces helper-only asset-ID tie coverage with D1-backed July fallback fixtures that exercise taken date, memory creation timestamp, and asset sort order.

### Commit hash

- `b12bf278edb2bc391554dd1c621a416e0b49a1d0` — `test: cover D1 timeline fallback ordering`

### Exact command and result

```text
npm.cmd exec vitest run worker/lib/timeline.test.ts worker/lib/memories.pagination.test.ts
```

Result: PASS — 2 test files passed and 4 tests passed.

### Concerns

- None. Vitest used inspector port 9230 because 9229 was unavailable; this did not affect the passing test result.
