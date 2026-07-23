# Memory Timeline and Period Covers Design

**Date:** 2026-07-22  
**Status:** Proposed for implementation review

## Goal

Add a public chronological timeline for the shared photo archive. The timeline should present the memories using the approved Memory River layout: a centered chronological line with alternating memory previews, year markers, and clean editorial spacing.

The owner must be able to quickly choose one public photo as the cover for a year and one public photo as the cover for each month that contains memories. Selecting a cover must never modify or delete the source photo.

## Scope

### In scope

- A dedicated `/timeline` page using the approved alternating timeline layout.
- Chronological grouping by year and month using each memory's existing date.
- One explicit year cover per year.
- One explicit month cover per `YYYY-MM` period.
- Owner actions to set or replace a year/month cover from an existing public asset.
- Timeline preview cropping for consistent horizontal cards.
- A click-through from a timeline cover to its owning memory with the selected asset opened in the lightbox.
- Responsive behavior for desktop and mobile layouts.
- Public filtering so private assets never appear as public timeline covers.

### Out of scope

- Birthday copy or other new homepage marketing copy.
- Per-photo descriptions or captions.
- Editing or re-encoding original files.
- A general-purpose image editor.
- Changing existing Gallery pagination, Memory detail behavior, or asset visibility semantics except where needed for the new owner action.

## User experience

### Public timeline

The page uses the Memory River layout:

- A centered heading and a compact year jump row.
- A delicate vertical line with year markers.
- Alternating left/right memory entries.
- Each preview uses a consistent approximately 3:2 horizontal frame.
- Each entry shows the existing memory title, date, location, and cover image only.
- Clicking the image or entry navigates to `/memory/:memoryId?asset=:assetId`.
- The memory detail page opens the selected asset in its existing lightbox, while retaining access to the rest of the album.

Only public published memories and public assets are eligible for the public timeline. Months with no memories are not rendered as empty public cards. A period without an explicit cover uses a deterministic public fallback: the newest public asset in that period, then the memory's public cover asset when available.

### Owner cover action

On an owner-visible asset, add a compact `Set timeline cover` action. The action opens a small menu whose period values are inferred from the asset's memory date:

- `Set as 2026 year cover`
- `Set as 2026-06 month cover`

If the period already has a cover, the action is labeled as a replacement and confirms that the old cover will remain a normal photo. The owner can also see which period covers the asset currently represents. Private assets cannot be selected for a public period cover; the UI should explain that the asset must be made public first.

The same menu can clear an existing period cover. Clearing only removes the explicit selection and immediately restores the deterministic public fallback; it never deletes the photo.

The owner action is available from the existing memory detail asset controls. A later management screen is not required for the first release.

## Cropping and image handling

- Original R2 objects and their metadata remain unchanged.
- Timeline cards use an existing derivative URL and CSS framing; no new original image is created.
- The overview frame uses `object-fit: cover` with a consistent horizontal aspect ratio.
- Portrait images use a subject-safe default position that favors the upper-center area; landscape images use center positioning.
- The full uncropped image remains available through the memory detail lightbox.
- The implementation should keep the crop behavior isolated to the timeline component so Gallery and Memory detail retain their current rendering.
- If the existing asset metadata supports a later focal-point adjustment, the design leaves room for a per-asset focal point, but a manual crop editor is not required for the first release.

## Data model

Add a normalized period-cover table rather than adding year/month columns to `memories` or `media_assets`:

```text
timeline_covers
  id
  period_type       -- year | month
  period_key        -- YYYY or YYYY-MM
  asset_id
  created_by
  created_at
  updated_at
```

Constraints:

- Unique `(period_type, period_key)` so each period has at most one explicit cover.
- `asset_id` references `media_assets` and is removed with the asset.
- The API validates that the selected asset belongs to a published memory, is an image, and is public.
- The period key must match the selected memory's date.
- Replacing a cover updates the row and does not delete the previous asset.

The timeline response should include the resolved cover asset, memory ID, memory title, date, and location so the client can render and navigate without another lookup per entry.

## API shape

- `GET /api/timeline` returns public year/month groups and resolved cover entries.
- `PUT /api/timeline/covers` is owner-only and idempotently sets or replaces one period cover.
- `DELETE /api/timeline/covers/:periodType/:periodKey` is owner-only and restores fallback behavior without deleting the photo.

The owner mutation must invalidate the timeline query and relevant memory queries. Public responses must never expose private assets through fallback or explicit-cover resolution.

## Responsive behavior

- Desktop uses the centered line and alternating entries.
- At the mobile breakpoint, the line moves to the left edge and all entries become a single column.
- Cropped preview cards keep the same aspect ratio on both breakpoints, with metadata below the image.
- Year jump links remain horizontally scrollable rather than wrapping into a dense control block.

## Acceptance criteria

- A public visitor can open `/timeline` and see memories grouped chronologically without private assets.
- A year with no explicit cover still renders using the documented deterministic fallback.
- The owner can set, replace, and clear a year or month cover from an existing public image.
- Setting a cover does not alter the image, memory, visibility, or album ordering.
- A timeline cover click opens the correct memory and selected asset in the lightbox.
- Portrait source images remain recognizable in the overview crop, and the full original remains available in detail.
- Gallery pagination and existing Memory detail asset controls continue to pass their current tests.
- The new worker, database, client, and i18n behavior has focused unit/integration coverage before release.
