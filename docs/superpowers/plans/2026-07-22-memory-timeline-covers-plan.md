# Memory Timeline Covers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public chronological “Memory River” timeline that groups published public photos by year and month, uses deterministic cover selection, and lets an owner set or clear one public photo as the year or month cover without changing the original asset.

**Architecture:** Add a small D1 timeline_covers table keyed by (period_type, period_key). The Worker exposes a public read endpoint and owner-only set/clear endpoints. The React client renders a dedicated /timeline route with fixed-ratio preview crops and links every cover to the existing memory detail lightbox through ?asset=<assetId>. Existing Gallery, memory-level covers, asset visibility, upload flow, and original image delivery remain intact.

**Tech Stack:** React 19, TypeScript, React Router 7, TanStack Query 5, Clerk, Cloudflare Workers, D1, R2, Vitest, jsdom.

## Global Constraints

- Use the existing shared main worktree at D:\Downloads\OurLoveStory-V3; do not create a new branch or worktree.
- Use TDD for every behavior change: add a focused failing test, implement the smallest change, then run the focused test before moving on.
- Do not redesign the confirmed feature: use the Option 1 “Memory River” layout, not a portrait-first layout.
- Crop only the timeline preview frame with CSS/object-fit. Never overwrite, resize, or persist a cropped copy of the original photo.
- Preserve the existing full image lightbox and owner original-download behavior. Timeline clicks must open the exact existing asset.
- Timeline public data contains only published memories with public image assets. Never return private asset URLs to a guest or to the public timeline.
- An owner may select only a public image asset whose memory is published. A private asset must be made public first.
- Store at most one explicit cover for each YYYY year and each YYYY-MM month. Replacing a cover updates the row and does not delete the previous asset.
- If no explicit cover is valid, choose the newest eligible public image in the period; keep the fallback deterministic by date, memory creation time, asset sort order, and asset id.
- Do not add birthday copy, per-photo descriptions, focal-point editing, a new asset-management screen, or a second gallery implementation.
- Do not push, deploy, execute a remote D1 migration, or mutate production R2 during implementation. Local tests and wrangler deploy --dry-run are the release checks in this plan.

---

## Task 1: Add the timeline cover schema and shared contracts

**Files:**

- Create: database/migrations/0004_timeline_covers.sql
- Modify: database/schema.sql
- Modify: shared/contracts.ts
- Create: worker/lib/timeline-validation.ts
- Create: worker/lib/timeline.validation.test.ts

### Step 1: Write the failing validation tests

Add tests for a pure validation module that accepts only:

    parseTimelineCoverInput({ periodType: 'year', periodKey: '2026', assetId: 'asset-1' });
    parseTimelineCoverInput({ periodType: 'month', periodKey: '2026-07', assetId: 'asset-1' });

The tests must assert that it rejects a malformed year, malformed month, an unsupported period type, an empty asset id, and a month whose month number is outside 01–12.

Run:

    npm.cmd exec vitest run worker/lib/timeline.validation.test.ts

Expected result: FAIL because the validation module and timeline contracts do not exist yet.

### Step 2: Implement the schema and contracts

Add timeline_covers to the canonical schema and create migration 0004_timeline_covers.sql with:

- id text primary key;
- period_type constrained to year or month;
- period_key text not null;
- memory_id and asset_id foreign keys with ON DELETE CASCADE;
- created_by and timestamps;
- a unique constraint on (period_type, period_key);
- an index supporting period lookup.

Add these shared types in shared/contracts.ts:

    export type TimelinePeriodType = 'year' | 'month';

    export interface TimelineCoverInput {
      periodType: TimelinePeriodType;
      periodKey: string;
      assetId: string;
    }

    export interface TimelinePhoto {
      memoryId: string;
      memoryTitle: string;
      memoryDate: string;
      memoryLocation: string;
      assetId: string;
      previewUrl: string;
      thumbnailUrl: string;
      filename: string;
      isExplicitCover: boolean;
    }

    export interface TimelineMonth {
      key: string;
      year: string;
      month: number;
      label: string;
      photoCount: number;
      cover: TimelinePhoto;
    }

    export interface TimelineYear {
      key: string;
      label: string;
      photoCount: number;
      cover: TimelinePhoto;
      months: TimelineMonth[];
    }

    export interface TimelineResponse {
      years: TimelineYear[];
    }

Implement parseTimelineCoverInput in worker/lib/timeline-validation.ts with ValidationError, and keep the returned period key normalized exactly as received after validation. Add migration/schema parity assertions in the validation test by reading the migration and checking the table and unique-period definitions are present.

Run:

    npm.cmd exec vitest run worker/lib/timeline.validation.test.ts

Expected result: PASS.

### Step 3: Commit the completed task

    git add database/schema.sql database/migrations/0004_timeline_covers.sql shared/contracts.ts worker/lib/timeline-validation.ts worker/lib/timeline.validation.test.ts
    git commit -m "feat: add timeline cover schema and contracts"

---

## Task 2: Implement public timeline assembly with deterministic fallback

**Files:**

- Create: worker/lib/timeline.ts
- Create: worker/lib/timeline.test.ts

### Step 1: Write failing D1-backed tests

Use the existing Miniflare + D1 setup from worker/lib/memories.pagination.test.ts and the canonical schema. Insert fixtures covering:

- two published memories in the same year but different months;
- multiple public images in one month with different taken_at, created_at, and sort_order values;
- one private image and one draft memory that must not appear;
- one explicit year cover and one explicit month cover;
- a cover row whose asset is later made private, which must be ignored in the public response.

Add assertions that:

- years are newest-first and months are newest-first;
- every visible year/month has exactly one cover;
- explicit valid covers win over the fallback;
- the fallback is deterministic and picks the newest eligible public image;
- private, draft, video, and invalid explicit-cover rows are absent;
- previewUrl and thumbnailUrl use the existing /api/assets/:assetId/preview and /thumbnail routes;
- memoryId and assetId are preserved for the detail deep link.

Run:

    npm.cmd exec vitest run worker/lib/timeline.test.ts

Expected result: FAIL because listTimeline does not exist.

### Step 2: Implement listTimeline

Implement listTimeline(env: Env): Promise<TimelineResponse> in worker/lib/timeline.ts:

1. Query only published memories with public image assets.
2. Query explicit timeline_covers through the same visibility-safe joins.
3. Group eligible photos by YYYY and YYYY-MM derived from the ISO taken_at date.
4. Select the explicit cover when its joined asset is still eligible; otherwise select the first deterministic fallback.
5. Build the nested years -> months response with photoCount.
6. Keep the SQL/result mapping free of original URLs; timeline previews use derivatives only.

Use a pure helper inside the module for cover selection so its tie-breaking behavior is directly testable. Do not use a random id, current time, or object-storage listing order as a tie breaker.

Run:

    npm.cmd exec vitest run worker/lib/timeline.test.ts worker/lib/memories.pagination.test.ts

Expected result: PASS.

### Step 3: Commit the completed task

    git add worker/lib/timeline.ts worker/lib/timeline.test.ts
    git commit -m "feat: assemble public memory timeline"

---

## Task 3: Add Worker GET/PUT/DELETE timeline routes and owner validation

**Files:**

- Modify: worker/index.ts
- Modify: worker/lib/timeline.ts
- Create: worker/lib/timeline.routes.test.ts

### Step 1: Write failing route tests

Add route-level tests through the Worker fetch handler for:

- GET /api/timeline returning the public TimelineResponse without authentication;
- PUT /api/timeline/covers requiring the owner session;
- DELETE /api/timeline/covers?periodType=year&periodKey=2026 requiring the owner session;
- a non-owner receiving the existing unauthorized response for both mutations;
- selecting a private asset, a video asset, a draft memory, or a memory/date mismatch returning 400 and leaving the table unchanged;
- selecting a public image returning the new cover and replacing an existing row for the same period;
- clearing an existing period being idempotent and causing the next public GET to use fallback.

Run:

    npm.cmd exec vitest run worker/lib/timeline.routes.test.ts

Expected result: FAIL because the endpoints are not routed.

### Step 2: Implement the routes and mutation service

Add these exact endpoints:

- GET /api/timeline -> listTimeline(env);
- PUT /api/timeline/covers with JSON TimelineCoverInput -> owner-only validation, upsert, and a JSON TimelineCoverInput response;
- DELETE /api/timeline/covers with periodType and periodKey query parameters -> owner-only validation, delete-if-present, and 204.

The mutation validation must query the selected asset joined to its memory and require:

    media_type = image
    visibility = public
    memory.status = published
    asset.taken_at matches periodKey

The owner identity must be written to created_by on first insert. Use one upsert statement with ON CONFLICT(period_type, period_key) and update memory_id, asset_id, and updated_at on replacement. Do not alter memories.cover_asset_id or asset visibility.

Run:

    npm.cmd exec vitest run worker/lib/timeline.routes.test.ts worker/lib/timeline.test.ts
    npm.cmd run typecheck

Expected result: PASS.

### Step 3: Commit the completed task

    git add worker/index.ts worker/lib/timeline.ts worker/lib/timeline.routes.test.ts
    git commit -m "feat: add owner timeline cover routes"

---

## Task 4: Add typed client API, React Query hook, and timeline utilities

**Files:**

- Modify: src/lib/api.ts
- Create: src/hooks/useTimeline.ts
- Create: src/lib/timeline.ts
- Create: src/lib/timeline.test.ts
- Create: src/lib/api.timeline.test.ts

### Step 1: Write failing client tests

Add API tests asserting:

- getTimeline() requests /api/timeline with same-origin credentials;
- setTimelineCover(input, getToken) sends a JSON PUT to /api/timeline/covers and includes the owner bearer token through the existing apiRequest path;
- clearTimelineCover(periodType, periodKey, getToken) sends the encoded query string and DELETE.

Add pure utility tests for:

- selecting the cover link /memory/<encodedMemoryId>?asset=<encodedAssetId>;
- grouping/formatting timeline periods without mutating the API response;
- choosing a portrait-safe preview class after an image load event (naturalHeight > naturalWidth) while leaving the source URL unchanged.

Run:

    npm.cmd exec vitest run src/lib/api.timeline.test.ts src/lib/timeline.test.ts

Expected result: FAIL because the API functions, hook, and utility do not exist.

### Step 2: Implement the client layer

Add typed functions to src/lib/api.ts:

    getTimeline(): Promise<TimelineResponse>
    setTimelineCover(input: TimelineCoverInput, getToken: GetToken): Promise<TimelineCoverInput>
    clearTimelineCover(periodType: TimelinePeriodType, periodKey: string, getToken: GetToken): Promise<void>

Add useTimeline() using React Query key ['timeline'], with no owner token required for the public read. Add timelineCoverHref(photo) and deterministic client-side presentation helpers in src/lib/timeline.ts; these helpers must not duplicate server cover selection.

Run:

    npm.cmd exec vitest run src/lib/api.timeline.test.ts src/lib/timeline.test.ts
    npm.cmd run typecheck

Expected result: PASS.

### Step 3: Commit the completed task

    git add src/lib/api.ts src/hooks/useTimeline.ts src/lib/timeline.ts src/lib/timeline.test.ts src/lib/api.timeline.test.ts
    git commit -m "feat: add timeline client data layer"

---

## Task 5: Build the Option 1 Memory River page and responsive smart-crop preview

**Files:**

- Create: src/pages/TimelinePage.tsx
- Create: src/pages/TimelinePage.test.tsx
- Create: src/components/TimelinePhoto.tsx
- Modify: src/styles/feature-upgrades.css
- Modify: src/i18n/translations.ts

### Step 1: Write failing component tests

Render the page with a small TimelineResponse fixture and assert:

- year labels and month labels render in newest-first order;
- year and month cards use the same timeline image component and have a stable 3 / 2 preview frame;
- every cover image is linked to its exact memory and asset query parameters;
- the page does not render birthday copy, photo descriptions, or an empty month card;
- a portrait image load applies the portrait-safe class but still renders the same previewUrl.

Run:

    npm.cmd exec vitest run src/pages/TimelinePage.test.tsx

Expected result: FAIL because the page and component do not exist.

### Step 2: Implement the page and visual system

Implement TimelinePage with:

- the current .page-shell and .page-intro visual language;
- a vertical year rail/river using year markers and a content column;
- one larger year cover card followed by a compact month-card row/grid;
- fixed aspect-ratio 3 / 2, overflow hidden, and object-fit cover on timeline previews;
- TimelinePhoto using onLoad to classify portrait images and set a safe upper-third object-position, while landscape images stay centered;
- loading lazy for all timeline images except the first visible year cover;
- accessible alt text based on the memory title and period label, with no new photo-description field;
- a graceful loading, error, and no-public-memories state using existing status styles.

Use the existing colors, fonts, border radius, and shadow tokens. Do not add a dependency or change Gallery’s masonry styles. The card click must use timelineCoverHref and let the existing memory detail route open the lightbox.

Run:

    npm.cmd exec vitest run src/pages/TimelinePage.test.tsx
    npm.cmd run typecheck

Expected result: PASS.

### Step 3: Commit the completed task

    git add src/pages/TimelinePage.tsx src/pages/TimelinePage.test.tsx src/components/TimelinePhoto.tsx src/styles/feature-upgrades.css src/i18n/translations.ts
    git commit -m "feat: add memory river timeline page"

---

## Task 6: Deep-link the existing lightbox and add owner cover controls on memory detail

**Files:**

- Modify: src/pages/MemoryDetailPage.tsx
- Modify: src/pages/MemoryDetailPage.image-delivery.test.tsx
- Modify: src/styles/feature-upgrades.css
- Modify: src/i18n/translations.ts

### Step 1: Write failing detail-page tests

Extend the existing detail test fixture and router mock to cover:

- /memory/memory-1?asset=image-guest opening the exact selected image in the existing lightbox on first render;
- an unknown/private asset query parameter not opening the lightbox;
- an owner seeing timeline-cover controls only for a public image asset;
- a private image and any video not showing the public timeline-cover controls;
- invoking set year cover and set month cover calling the typed API with 2026 and 2026-07 derived from the memory date;
- clearing a year/month cover invalidating ['timeline'] without changing asset visibility or the memory cover.

Run:

    npm.cmd exec vitest run src/pages/MemoryDetailPage.image-delivery.test.tsx

Expected result: FAIL because the search-param initialization and controls do not exist.

### Step 2: Implement deep linking and controls

Use useLocation to read asset from the query string and synchronize selectedImageId after the memory and image list are available. Keep the existing lightbox component and previous/next behavior. The query parameter is an initial selection; closing the lightbox may leave the URL unchanged.

Add a compact owner-only details/popover-style control in each eligible image asset footer:

- Set as year cover;
- Set as month cover;
- Clear year cover;
- Clear month cover.

Use the memory’s ISO date to derive the period keys. Show a busy state per asset, disable controls while the mutation is pending, invalidate ['timeline'] after success, and keep existing visibility/delete optimistic behavior unchanged. Errors must use the current detail alert styling and translations.

Add focused CSS so the control occupies a consistent full-width footer row on desktop and mobile; do not recreate the earlier uneven button layout.

Run:

    npm.cmd exec vitest run src/pages/MemoryDetailPage.image-delivery.test.tsx
    npm.cmd run typecheck

Expected result: PASS.

### Step 3: Commit the completed task

    git add src/pages/MemoryDetailPage.tsx src/pages/MemoryDetailPage.image-delivery.test.tsx src/styles/feature-upgrades.css src/i18n/translations.ts
    git commit -m "feat: link timeline covers to memory lightbox"

---

## Task 7: Register the route and preserve navigation semantics

**Files:**

- Modify: src/App.tsx
- Modify: src/components/Header.tsx
- Modify: src/components/Header.test.tsx if the existing header test exists, otherwise create it
- Modify: src/i18n/translations.ts

### Step 1: Write failing route/navigation tests

Add assertions that:

- /timeline renders TimelinePage under the existing BrowserRouter;
- the existing Journal navigation label goes to /timeline;
- Gallery and Home routes remain unchanged;
- owner-only Studio navigation remains owner-only.

Run:

    npm.cmd exec vitest run src/components/Header.test.tsx src/pages/TimelinePage.test.tsx

Expected result: FAIL because the route and Journal destination are not registered.

### Step 2: Implement the route

Import TimelinePage in src/App.tsx and add the /timeline route. Change only the existing Journal link destination in Header from /#journal to /timeline; keep the homepage journal section and its Browse all memories link intact so existing home content remains reachable. Add the minimum English and Chinese timeline labels/status strings required by the page and controls.

Run:

    npm.cmd exec vitest run src/components/Header.test.tsx src/pages/TimelinePage.test.tsx
    npm.cmd run typecheck

Expected result: PASS.

### Step 3: Commit the completed task

    git add src/App.tsx src/components/Header.tsx src/components/Header.test.tsx src/i18n/translations.ts
    git commit -m "feat: expose the memory timeline route"

---

## Task 8: Full verification, migration parity, and release handoff

**Files:**

- Modify: README.md with the local/remote D1 migration command and the no-secret/no-R2-change note, if the existing database section has no migration instructions.
- Create: docs/superpowers/plans/2026-07-22-memory-timeline-covers-verification.md

### Step 1: Add verification notes and run a fresh local suite

Document the test fixture coverage, the migration filename, the public/private boundary, and the manual checks. Then run the checks sequentially from a clean working tree:

    npm.cmd run typecheck
    npm.cmd test
    npm.cmd run build
    npm.cmd exec wrangler -- deploy --dry-run
    git diff --check
    git status --short

Expected result: all commands pass, the dry run lists the existing DB/MEDIA/IMAGES/ASSETS bindings, and git status --short contains only intentionally staged/committed documentation changes or is clean.

### Step 2: Perform browser-level local verification

Start the existing local app/Worker with the repository’s documented command and verify:

1. /timeline loads without owner authentication.
2. Private and draft assets never appear in the public timeline.
3. Portrait previews remain visually balanced in the same horizontal frame without modifying the source URL.
4. Clicking a year/month cover opens the matching memory and exact image in the existing lightbox.
5. As owner, a public image can replace the year and month covers; a private image cannot.
6. Clearing a cover returns the deterministic fallback.
7. Existing /gallery, /memory/:memoryId, uploads, downloads, and visibility toggles still work.

Capture pass/fail evidence in the verification document. Do not deploy or run the remote migration in this task; those are release-gated follow-up actions.

### Step 3: Self-review before handoff

Review the diff for:

- no private URL in timeline JSON or HTML;
- no mutation of memories.cover_asset_id when setting timeline covers;
- correct year/month key validation and date matching;
- no duplicate API request on route mount;
- no uncropped full-resolution image loaded by timeline cards;
- no missing English/Chinese translation keys;
- no accidental changes to Gallery pagination or existing lightbox behavior.

### Step 4: Commit the verification artifact

    git add README.md docs/superpowers/plans/2026-07-22-memory-timeline-covers-verification.md
    git commit -m "docs: record timeline verification"

After this task, stop for review. Push/deploy and remote D1 migration remain separate explicit release actions.

---

## Plan self-review

- Every backend behavior has a focused test before implementation, plus existing pagination/image-delivery regressions in the relevant commands.
- The schema, shared contracts, Worker response, client API, React Query hook, page, deep link, owner controls, route, and translations are all mapped to concrete files.
- The confirmed rules are explicit: Option 1 layout, safe preview crop only, public-only timeline, public-image-only owner selection, one cover per period, deterministic fallback, exact lightbox deep link, no birthday copy, and no photo descriptions.
- No new dependency is required; all implementation uses current React, TanStack Query, Worker, D1, and Vitest conventions.
- The final verification covers type checking, all tests, production build, Cloudflare dry run, browser behavior, privacy, and git diff hygiene.
