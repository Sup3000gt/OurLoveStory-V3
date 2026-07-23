# Memory Discovery, Navigation, Performance, and Sharing Design

**Date:** 2026-07-23
**Status:** Approved design
**Scope:** Gallery search and filtering, Timeline navigation, mobile usability, image performance, and public link sharing

## Context

OurLoveStory already supports:

- a paginated Gallery with category filters;
- public and private asset visibility;
- a public Timeline with configurable year and month covers;
- month archive pages;
- secure thumbnail, preview, and original-image delivery;
- desktop and mobile layouts.

As the collection grows, the main remaining problem is discovery. Visitors need to find a memory by topic, location, or date; move naturally between months and years; and share a public view without exposing private media. These improvements must extend the existing Gallery and Timeline instead of creating a competing "Explore" section.

## Goals

1. Search memory titles, locations, and descriptions.
2. Combine search with category, year, and month filters.
3. Preserve all Gallery state in the URL.
4. Add year navigation to the Timeline and previous/next navigation to month archives.
5. Provide a polished responsive experience on phones.
6. Improve perceived and measured image-loading performance.
7. Share public Gallery views, Timeline years, month archives, and individual memories as links.
8. Preserve the existing owner/guest privacy boundary.

## Non-goals

- No face recognition, image-content recognition, or filename search.
- No new global Explore page or global command palette.
- No QR codes.
- No social-platform-specific Open Graph rendering in the first release.
- No full-text search engine or D1 FTS table in the first release.
- No change to existing upload, cover-selection, or visibility workflows.
- No sharing of private assets through tokens or temporary public links.

## Chosen Product Direction

The design integrates discovery into existing pages:

- Gallery becomes the main searchable and filterable collection.
- Timeline remains the chronological story.
- Month archives become the continuous month-to-month browsing surface.
- A shared link component provides a consistent action across all public surfaces.

This keeps the navigation compact and avoids duplicating the same memories across Gallery and a new search page.

## Gallery Experience

### Desktop layout

The Gallery intro is followed by a two-row discovery panel:

```text
[ Search titles, places, or notes...                         ] [ Share ]

[ All ] [ Travel ] [ Daily Life ] [ ... ]    [ Year ▼ ] [ Month ▼ ] [ Clear ]
```

Below the controls, a result summary displays the filtered count:

```text
8 memories found
```

The existing masonry grid and numbered previous/next page controls remain.

### Search behavior

- Search matches `title`, `location`, and `description`.
- Search trims leading and trailing whitespace and collapses repeated whitespace.
- Matching treats the normalized query as one substring.
- English matching is case-insensitive; Chinese text is matched directly.
- Search begins 300 ms after the user stops typing.
- Clearing the search immediately returns to the filtered non-search result set.
- Search input is limited to 80 characters.
- Literal `%`, `_`, and `\` characters are escaped before the SQL `LIKE` query.

### Filter behavior

- Category, year, and month can be combined with the search term.
- Month is disabled until a year is selected.
- Clearing the year also clears the month.
- Changing any search or filter value returns the user to page 1.
- Available years and months come from owner-aware Gallery facet data.
- An owner can search public and private memories.
- A guest can search only published memories containing at least one public asset.

### URL state

Gallery state is represented with canonical query parameters:

```text
/gallery?q=韩餐&category=Dining+Out&year=2026&month=5
```

Rules:

- Default values are omitted.
- Parameters use a stable order: `q`, `category`, `year`, `month`.
- Invalid client-side values are removed and replaced with the nearest valid state.
- Browser refresh, Back, and Forward restore the same search and filters.
- Pagination remains cursor-based session state and does not create URL history entries.
- Refreshing or sharing a Gallery URL opens the first page of the filtered result.
- The URL is updated with history replacement while typing and a history entry when a committed filter changes.

### Result and empty states

- While a new result is loading, the previous grid remains visible with a subtle loading veil.
- A zero-result state reads "No memories matched these filters" and offers "Clear filters."
- A request failure keeps the current controls and last successful grid, with a Retry action.
- The result total is announced through a polite live region without moving keyboard focus.

## Gallery Facets

A lightweight owner-aware endpoint provides filter options:

```text
GET /api/memories/facets
```

Response:

```json
{
  "years": [
    {
      "year": 2026,
      "months": [3, 4, 5, 6]
    }
  ]
}
```

The endpoint follows the same access rules as `GET /api/memories`:

- owners receive years and months from all their memories;
- guests receive years and months only from published memories with public assets.

The response is cached through TanStack Query. It does not change when the user edits the active search query.

## Memory Search API

### Request

Extend the existing paginated endpoint:

```text
GET /api/memories
  ?q=韩餐
  &category=Dining+Out
  &year=2026
  &month=5
  &cursor=...
  &limit=12
```

Validation:

- `q`: optional normalized string, maximum 80 characters;
- `category`: optional existing `MemoryCategory`;
- `year`: optional four-digit year;
- `month`: optional integer from 1 through 12 and valid only when `year` is present;
- `cursor`: existing opaque cursor;
- `limit`: existing normalized page size.

Invalid direct API requests return `400`. The browser UI normalizes invalid URL state before making a request.

### Response

Extend `MemoryPage`:

```ts
interface MemoryPage {
  memories: Memory[];
  nextCursor: string | null;
  totalCount: number;
}
```

`totalCount` uses the same search, filters, and access conditions as the page query. It counts memories, not assets.

### Query behavior

The Worker builds parameterized clauses for:

- owner or guest access;
- normalized search text across title, location, and description;
- category;
- an index-friendly year or month date range;
- the existing stable cursor order.

Date ranges use inclusive start and exclusive end values:

```text
2026-05-01 <= taken_at < 2026-06-01
```

The final order remains:

```text
taken_at DESC, created_at DESC, id DESC
```

The cursor remains opaque and does not embed filter values. The frontend query key and URL state ensure that a cursor is never reused with a different filter set.

### Database indexes

Add a migration containing indexes for the filtered cursor queries:

- date plus stable cursor columns;
- category plus date and cursor columns;
- status plus date and cursor columns for guest queries.

Substring search cannot use a normal B-tree index. The current collection size makes a parameterized `LIKE` search acceptable. If the collection grows beyond roughly 5,000 memories or measured search latency becomes unacceptable, a separate FTS migration can be designed later.

## Frontend Architecture

### New units

- `GallerySearchBar`
  - owns the text input presentation;
  - emits a normalized committed query after the debounce;
  - provides a clear action.
- `GalleryFilters`
  - renders category, year, and month controls;
  - enforces the year/month dependency.
- `ActiveFilterSummary`
  - displays `totalCount`;
  - provides a Clear All action.
- `MobileFilterSheet`
  - renders filters in a native dialog styled as a bottom sheet;
  - does not duplicate filter state.
- `TimelineYearNav`
  - renders available years as anchor controls;
  - scrolls to stable year anchors.
- `TimelineMonthNavigator`
  - renders the nearest previous and next non-empty months.
- `ShareLinkButton`
  - shares or copies the canonical current URL;
  - provides success and failure feedback.

### State ownership

Gallery URL parameters are the source of truth for search and filters. A dedicated parser/serializer converts between `URLSearchParams` and a typed `GalleryFilterState`. The loaded cursor pages and active page index remain local query state.

`useMemories(filters)` includes every server-side filter and owner status in its TanStack Query key. It keeps previous data during a new request and resets pagination when the filter identity changes.

The same state object is used by desktop controls and the mobile sheet. The mobile sheet maintains only an uncommitted local draft while open; Apply writes one URL update, and Cancel discards the draft.

## Timeline Navigation

### Year navigation

The Timeline intro is followed by compact year anchors:

```text
[ 2024 ] [ 2025 ] [ 2026 ]
```

- Each year section has a stable `id`, such as `year-2026`.
- Selecting a year updates the URL hash and scrolls to the section.
- Loading `/timeline#year-2026` scrolls after Timeline data is available.
- Each year heading has a Share action that copies the hash URL.
- Reduced-motion users receive an immediate jump rather than animated scrolling.

### Month archive navigation

Month archive pages load the public Timeline summary in addition to the paginated month memories. The summary determines the nearest previous and next months that contain public photos.

Navigation appears above and below the archive:

```text
[ ← March 2026 ]       April 2026       [ May 2026 → ]
```

- Empty months are skipped.
- The first and last month render only the available direction.
- The destination always begins on page 1.
- A month archive remains a public storytelling surface, even when the owner is signed in.
- Invalid month paths show an error and a Back to Timeline action.

## Link Sharing

`ShareLinkButton` is added to:

- the Gallery discovery panel;
- each Timeline year heading;
- the month archive heading;
- the memory detail heading.

Canonical targets:

- filtered Gallery: `/gallery?...`;
- Timeline year: `/timeline#year-2026`;
- month archive: `/timeline/2026-04`;
- memory: `/memory/:memoryId`.

Behavior:

1. Use `navigator.share` when available.
2. Otherwise copy the canonical absolute URL with the Clipboard API.
3. If clipboard access fails, reveal a read-only selected URL field for manual copying.
4. Announce success or failure with a polite live region.

The payload contains only the page title and URL. There are no QR codes, access tokens, user identifiers, or private asset URLs.

When an owner shares a filtered Gallery URL, feedback explicitly states that visitors will see only public memories. The same URL may therefore show fewer results for a guest than for the signed-in owner.

## Mobile Design

At widths below 620 px:

- the search field remains directly visible;
- category chips become a horizontally scrollable row;
- year, month, Clear All, and secondary filters move into a "Filters (n)" button;
- `MobileFilterSheet` opens from the bottom;
- the sheet uses a native dialog, traps focus, closes with Escape, and returns focus to the trigger;
- Apply and Cancel actions remain visible at the bottom of the sheet;
- month navigation uses short localized labels and stacked wrapping when necessary;
- share controls use an icon and short label;
- all interactive targets are at least 44 by 44 CSS pixels;
- no control relies on hover.

The masonry grid remains one column on narrow phones and follows the existing two-column tablet breakpoint.

## Image and Rendering Performance

The existing secure derivative model remains:

- 640 px WebP thumbnail;
- 2048 px WebP preview;
- owner-only original download;
- lazy loading for non-priority images.

Enhancements:

1. Include optional `width` and `height` on image asset contracts and memory queries.
2. Render image dimensions or an aspect-ratio fallback before bytes arrive to reduce layout shift.
3. Give only the first two visible Gallery covers high fetch priority; keep all other cards lazy.
4. Keep the first Timeline year cover eager and all later Timeline photos lazy.
5. Apply `content-visibility: auto` with a conservative intrinsic-size fallback to offscreen cards.
6. Keep previous result data during filter transitions.
7. Prefetch only the next page JSON when the browser is idle and data-saving mode is not enabled; do not preload its images.
8. Keep existing private and public derivative cache controls unchanged so visibility changes cannot expose stale public media.

Nullable legacy width and height values fall back to the current CSS card ratio. No data migration is required because the database already stores nullable media dimensions.

## Accessibility

- The search field has a visible label or persistent accessible name.
- Clear Search and Clear All are distinct actions.
- Category chips use `aria-pressed`.
- The result summary uses `aria-live="polite"`.
- Native selects have visible labels in the mobile sheet.
- The filter dialog has a heading and an accessible description.
- Focus returns to the filter trigger after closing.
- Year anchors and month navigation include textual dates, not icon-only arrows.
- Share feedback is available to screen readers.
- Visible focus treatment is preserved for every new control.
- Smooth scrolling and sheet motion honor `prefers-reduced-motion`.
- Color is not the only indicator of an active filter.

## Error Handling

### Search and filtering

- Invalid browser query parameters are removed and do not crash rendering.
- A failed filtered request preserves the last successful result grid.
- Retry repeats the same canonical query.
- A zero-result state retains the active filters so the user can adjust one field.

### Timeline

- Failure to load Timeline navigation does not hide already-loaded month memories.
- If adjacent-month data is unavailable, the page falls back to Back to Timeline.
- An invalid month path never sends an unbounded memory query.

### Sharing

- Share cancellation produces no error toast.
- Clipboard failure exposes a manual copy field.
- Sharing never requests authentication and never generates a private-media URL.

### Images

- Existing derivative retry behavior remains.
- A failed image preserves card dimensions.
- Image errors do not remove the memory title or navigation link.

## Testing Strategy

### Worker and database tests

- search title, location, and description independently;
- combine query, category, year, and month;
- escape `%`, `_`, and `\`;
- reject invalid category, year, month, cursor, and oversized query;
- enforce month-requires-year;
- preserve stable cursor pagination without duplicates or omissions;
- return a matching `totalCount`;
- return owner-only private memories to owners;
- exclude unpublished memories and private-only assets from guest results;
- return owner-aware facets;
- verify new migration indexes exist.

### Frontend unit and component tests

- parse and serialize canonical Gallery URLs;
- omit default query parameters;
- debounce search and reset pagination;
- restore state through refresh, Back, and Forward;
- keep desktop and mobile controls synchronized;
- Apply and Cancel mobile filter drafts;
- render result, empty, retry, and loading states;
- skip empty months in previous/next navigation;
- scroll to a valid Timeline year hash after data loads;
- copy/share the correct canonical URL;
- fall back to manual copy;
- expose accessible labels, pressed states, dialog behavior, and live feedback;
- preserve image dimensions during loading and failure.

### End-to-end acceptance

Verify in production-sized desktop and mobile viewports:

1. Guest searches and combines all filters.
2. Owner receives private-inclusive Gallery results.
3. The same shared Gallery URL exposes only public results to a guest.
4. Browser navigation restores the exact Gallery state.
5. Timeline year links and month-to-month navigation work.
6. Share actions produce the expected canonical URLs.
7. Slow-network loading does not blank the grid or cause significant card movement.
8. Keyboard-only use can operate search, filters, dialog, year navigation, month navigation, and sharing.
9. No public API or rendered link contains a private asset URL, Clerk token, or owner identifier.

## Implementation Sequence

1. Extend shared contracts and add filter validation utilities.
2. Add D1 indexes, Worker search/filter/count queries, and facets endpoint with tests.
3. Add frontend URL parsing, API options, and filtered TanStack Query state with tests.
4. Build Gallery desktop controls, result states, and cursor pagination integration.
5. Build the mobile filter sheet and responsive styling.
6. Add Timeline year anchors and month archive previous/next navigation.
7. Add the shared link component to Gallery, Timeline, month, and memory pages.
8. Add image dimensions and rendering-performance improvements.
9. Run the full test, type-check, build, and production browser acceptance suite.

Each step is independently testable. Backend filtering lands before the controls that depend on it, and privacy tests land with the query changes rather than at the end.

## Acceptance Criteria

- A user can find memories by title, location, or description.
- Search, category, year, and month can be combined and restored from the URL.
- Cursor pagination remains efficient, and shared or refreshed filtered views begin on page 1.
- Gallery result totals match the access-controlled query.
- Owners can find private memories; guests cannot infer or retrieve them.
- Timeline years are directly navigable and shareable.
- Month archives provide previous and next non-empty month navigation.
- Desktop and phone controls remain readable, reachable, and keyboard accessible.
- Initial and filtered Gallery views avoid unnecessary image downloads and visible layout shifts.
- Gallery, Timeline year, month archive, and memory pages produce correct public links.
- No QR code or private sharing mechanism is introduced.
- Existing upload, Timeline cover, lightbox, and visibility behavior continues to pass regression tests.
