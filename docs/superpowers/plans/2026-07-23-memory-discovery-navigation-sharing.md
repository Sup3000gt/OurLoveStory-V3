# Memory Discovery, Navigation, Performance, and Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add searchable and filterable Gallery discovery, chronological year/month navigation, responsive mobile controls, stable image loading, and public link sharing while preserving the existing owner/private-media boundary.

**Architecture:** Extend the existing cursor-paginated /api/memories endpoint with validated search and date filters plus an owner-aware facets endpoint. Keep Gallery filter state in canonical URL query parameters, keep cursor pages as local TanStack Query state, and compose small controls into the existing Gallery and Timeline pages. Reuse the current secure image derivatives and add dimensions, priority loading, and responsive controls around them.

**Tech Stack:** React 19, TypeScript, React Router, TanStack Query, Clerk, Cloudflare Worker, Cloudflare D1, R2 image derivatives, Vitest, Miniflare, Vite.

## Global Constraints

- Search matches only memory title, location, and description; it does not use face recognition, image-content recognition, or filename search.
- Search text is normalized and limited to 80 characters.
- Month filtering is valid only when a year is present.
- Guests receive only published memories with at least one public asset; owners may search all owner-visible memories.
- Timeline and month archives remain public storytelling surfaces, including when the owner is signed in.
- Gallery URLs preserve search and filter state; cursor pagination remains local session state, so refresh/share opens the first filtered page.
- Share actions copy or share links only; no QR codes, access tokens, private asset URLs, or new private-sharing mechanism.
- Existing 640px thumbnails, 2048px previews, owner-only originals, lightbox behavior, upload flows, and timeline cover behavior remain compatible.
- Use TDD for every behavior: write a focused failing test, run it to observe failure, implement the minimum change, rerun the focused test, then run the relevant suite.
- Run Windows commands with npm.cmd; do not use git add ..
- After each completed task, stage only that task's files, commit, and push to origin main. Do not deploy until the final verification task and user acceptance.

---

## Task 1: Define shared discovery filters and API contracts

**Files:**
- Create: shared/memory-discovery.ts
- Create: shared/memory-discovery.test.ts
- Modify: shared/contracts.ts

**Interfaces:**
- Consumes: existing MemoryCategory from shared/contracts.ts.
- Produces: MemoryDiscoveryFilters, normalizeMemoryDiscoveryFilters, parseMemoryDiscoveryFilters, MemoryFacets, and MemoryPage.totalCount for Tasks 2–4.

- [ ] **Step 1: Write the failing contract tests**

~~~ts
import { describe, expect, it } from 'vitest';
import {
  normalizeMemoryDiscoveryFilters,
  parseMemoryDiscoveryFilters,
} from './memory-discovery';

describe('memory discovery filters', () => {
  it('normalizes query, category, year, and month', () => {
    expect(normalizeMemoryDiscoveryFilters({
      query: '  韩餐   ',
      category: 'Dining Out',
      year: '2026',
      month: '5',
    })).toEqual({
      query: '韩餐',
      category: 'Dining Out',
      year: '2026',
      month: 5,
    });
  });

  it('rejects month without year and an overlong query', () => {
    expect(() => normalizeMemoryDiscoveryFilters({ month: '5' }))
      .toThrow('Month requires a year.');
    expect(() => normalizeMemoryDiscoveryFilters({ query: 'x'.repeat(81) }))
      .toThrow('Search query is too long.');
  });

  it('parses URLSearchParams into the typed filter object', () => {
    expect(parseMemoryDiscoveryFilters(
      new URLSearchParams('q=%E9%9F%A9%E9%A4%90&category=Dining%20Out&year=2026&month=5'),
    )).toEqual({
      query: '韩餐',
      category: 'Dining Out',
      year: '2026',
      month: 5,
    });
  });
});
~~~

- [ ] **Step 2: Run the focused test and verify failure**

Run:

~~~powershell
npm.cmd run test -- shared/memory-discovery.test.ts
~~~

Expected: FAIL because shared/memory-discovery.ts and the new contract fields do not exist.

- [ ] **Step 3: Add the shared filter types and normalizers**

Create these exact public types and functions:

~~~ts
export const MAX_MEMORY_SEARCH_LENGTH = 80;

export interface MemoryDiscoveryFilters {
  query: string | null;
  category: MemoryCategory | null;
  year: string | null;
  month: number | null;
}

export interface MemoryFacets {
  years: Array<{ year: number; months: number[] }>;
}

export function normalizeMemoryDiscoveryFilters(input: {
  query?: unknown;
  category?: unknown;
  year?: unknown;
  month?: unknown;
}): MemoryDiscoveryFilters;

export function parseMemoryDiscoveryFilters(
  params: URLSearchParams,
): MemoryDiscoveryFilters;
~~~

The implementation trims and collapses whitespace, accepts only the five existing categories, requires a four-digit year, accepts months 1–12, and throws the exact validation messages asserted above. SQL escaping belongs to the Worker query layer.

Extend MemoryPage in shared/contracts.ts:

~~~ts
export interface MemoryPage {
  memories: Memory[];
  nextCursor: string | null;
  totalCount: number;
}
~~~

- [ ] **Step 4: Run tests and type-check**

~~~powershell
npm.cmd run test -- shared/memory-discovery.test.ts
npm.cmd run typecheck
~~~

Expected: focused tests pass and existing MemoryPage fixtures contain a numeric totalCount.

- [ ] **Step 5: Commit and push**

~~~powershell
git add -- shared/memory-discovery.ts shared/memory-discovery.test.ts shared/contracts.ts
git commit -m "feat: define memory discovery contracts"
git push origin main
~~~

---

## Task 2: Implement Worker search, filters, facets, and count queries

**Files:**
- Create: worker/lib/memory-filters.ts
- Create: worker/lib/memory-filters.test.ts
- Create: worker/lib/memory-facets.test.ts
- Modify: worker/lib/memories.ts
- Modify: worker/lib/memories.pagination.test.ts
- Modify: worker/index.ts
- Create: database/migrations/0005_memory_discovery_indexes.sql

**Interfaces:**
- Consumes: MemoryDiscoveryFilters and MemoryFacets from Task 1.
- Produces: listMemories(env, isOwner, { limit, cursor, query, category, year, month }), listMemoryFacets(env, isOwner), and GET /api/memories/facets.

- [ ] **Step 1: Write failing Worker tests**

~~~ts
it('escapes LIKE wildcards', () => {
  expect(escapeMemorySearchPattern('100% _ \\')).toBe('100\\% \\_ \\\\');
});

it('filters title, location, and description and returns totalCount', async () => {
  const page = await listMemories(env, false, {
    limit: 10,
    query: '韩餐',
    category: null,
    year: '2026',
    month: 5,
  });

  expect(page.memories.map((memory) => memory.title)).toEqual(['五月韩餐']);
  expect(page.totalCount).toBe(1);
});

it('does not expose private-only memories to a guest', async () => {
  const page = await listMemories(env, false, {
    limit: 10,
    query: 'private',
  });

  expect(page.memories).toEqual([]);
  expect(page.totalCount).toBe(0);
});

it('returns owner-aware facets', async () => {
  await expect(listMemoryFacets(env, false)).resolves.toEqual({
    years: [{ year: 2026, months: [4, 5] }],
  });
});
~~~

- [ ] **Step 2: Run focused Worker tests and verify failure**

~~~powershell
npm.cmd run test -- worker/lib/memory-filters.test.ts worker/lib/memories.pagination.test.ts worker/lib/memory-facets.test.ts
~~~

Expected: FAIL because the new options, search clauses, totalCount, facet function, and route do not exist.

- [ ] **Step 3: Implement query helpers**

Create these exact exports in worker/lib/memory-filters.ts:

~~~ts
export function escapeMemorySearchPattern(value: string): string;
export function memorySearchPattern(query: string | null): string | null;
export function memoryDateRange(filters: MemoryDiscoveryFilters): {
  start: string | null;
  end: string | null;
};
~~~

Use LIKE ? ESCAPE '\\' with a %...% binding. Build year and month ranges as inclusive start and exclusive end strings. Never interpolate user input into SQL.

- [ ] **Step 4: Extend listMemories without changing cursor order**

Update ListMemoriesOptions:

~~~ts
interface ListMemoriesOptions {
  limit: number;
  cursor?: string | null;
  query?: string | null;
  category?: string | null;
  year?: string | null;
  month?: number | null;
}
~~~

Keep the access clauses and ordering unchanged. Add parameterized conditions equivalent to:

~~~sql
AND (
  page.title LIKE ? ESCAPE '\\' COLLATE NOCASE
  OR page.location LIKE ? ESCAPE '\\' COLLATE NOCASE
  OR page.description LIKE ? ESCAPE '\\' COLLATE NOCASE
)
AND page.taken_at >= ?
AND page.taken_at < ?
~~~

Run a second parameterized count query with the same access and filter conditions, counting distinct memory IDs. Return totalCount with memories and nextCursor.

- [ ] **Step 5: Implement owner-aware facets and route wiring**

Add listMemoryFacets(env, isOwner) in worker/lib/memories.ts. Query distinct year/month values using the same access predicate as the list endpoint, group into ascending years, and sort each months array ascending.

Parse all discovery parameters through parseMemoryDiscoveryFilters before calling the list function. This converts month to a number and makes invalid direct API requests return 400:

~~~ts
const filters = parseMemoryDiscoveryFilters(url.searchParams);

if (url.pathname === '/api/memories/facets' && request.method === 'GET') {
  const owner = await optionalOwner(request, env);
  return json(await listMemoryFacets(env, Boolean(owner)));
}

if (url.pathname === '/api/memories' && request.method === 'GET') {
  const owner = await optionalOwner(request, env);
  return json(await listMemories(env, Boolean(owner), {
    limit: normalizeMemoryPageSize(url.searchParams.get('limit')),
    cursor: url.searchParams.get('cursor'),
    query: filters.query,
    category: filters.category,
    year: filters.year,
    month: filters.month,
  }));
}
~~~

Keep POST /api/memories unchanged and place the facets route before any /api/memories/:memoryId route.

- [ ] **Step 6: Add D1 indexes**

Create database/migrations/0005_memory_discovery_indexes.sql:

~~~sql
CREATE INDEX IF NOT EXISTS idx_memories_date_cursor
  ON memories(taken_at DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_memories_category_date_cursor
  ON memories(category, taken_at DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_memories_status_date_cursor
  ON memories(status, taken_at DESC, created_at DESC, id DESC);
~~~

Do not add a normal index for substring search; the approved design defers FTS until measured data volume requires it.

- [ ] **Step 7: Run tests, type-check, commit, and push**

~~~powershell
npm.cmd run test -- worker/lib/memory-filters.test.ts worker/lib/memories.pagination.test.ts worker/lib/memory-facets.test.ts
npm.cmd run typecheck
git add -- worker/lib/memory-filters.ts worker/lib/memory-filters.test.ts worker/lib/memories.ts worker/lib/memories.pagination.test.ts worker/lib/memory-facets.test.ts worker/index.ts database/migrations/0005_memory_discovery_indexes.sql shared/contracts.ts
git commit -m "feat: add memory discovery queries"
git push origin main
~~~

---

## Task 3: Add canonical Gallery URL state and filter-aware queries

**Files:**
- Create: src/lib/gallery-filters.ts
- Create: src/lib/gallery-filters.test.ts
- Create: src/hooks/useGalleryFilters.ts
- Create: src/hooks/useMemoryFacets.ts
- Modify: src/lib/api.ts
- Modify: src/lib/api.pagination.test.ts
- Modify: src/hooks/useMemories.ts
- Modify: src/App.tsx
- Create or modify: src/App.gallery-state.test.tsx

**Interfaces:**
- Consumes: Task 1 filter types and Task 2 API parameters.
- Produces: typed URL state for Task 4 and filter-aware TanStack Query state for Gallery.

- [ ] **Step 1: Write failing URL and API tests**

~~~ts
it('serializes non-default filters in stable order', () => {
  expect(toGallerySearch({
    query: '韩餐',
    category: 'Dining Out',
    year: '2026',
    month: 5,
  })).toBe('?q=%E9%9F%A9%E9%A4%90&category=Dining+Out&year=2026&month=5');
});

it('clears month when year is cleared', () => {
  expect(normalizeGalleryFilterState({
    query: '',
    category: 'All',
    year: '',
    month: 5,
  })).toEqual({
    query: '',
    category: 'All',
    year: '',
    month: null,
  });
});
~~~

Extend src/lib/api.pagination.test.ts:

~~~ts
it('passes query and date filters to the memory endpoint', async () => {
  await getMemories(undefined, {
    query: '韩餐',
    year: '2026',
    month: 5,
    limit: 12,
  });

  expect(fetchMock).toHaveBeenCalledWith(
    '/api/memories?limit=12&q=%E9%9F%A9%E9%A4%90&year=2026&month=5',
    expect.anything(),
  );
});
~~~

- [ ] **Step 2: Run focused tests and verify failure**

~~~powershell
npm.cmd run test -- src/lib/gallery-filters.test.ts src/lib/api.pagination.test.ts
~~~

Expected: FAIL because the parser, hook, API options, and totalCount response handling do not exist.

- [ ] **Step 3: Implement typed URL state**

Create src/lib/gallery-filters.ts with:

~~~ts
export interface GalleryFilterState {
  query: string;
  category: 'All' | Memory['category'];
  year: string;
  month: number | null;
}

export const emptyGalleryFilterState: GalleryFilterState = {
  query: '',
  category: 'All',
  year: '',
  month: null,
};

export function parseGallerySearch(search: string): GalleryFilterState;
export function normalizeGalleryFilterState(
  state: Partial<GalleryFilterState>,
): GalleryFilterState;
export function toGallerySearch(state: GalleryFilterState): string;
export function hasActiveGalleryFilters(state: GalleryFilterState): boolean;
~~~

Use the shared normalizer, omit defaults, preserve parameter order q, category, year, month, and never serialize page or cursor.

- [ ] **Step 4: Extend API and query hooks**

Extend MemoryPageOptions in src/lib/api.ts:

~~~ts
export interface MemoryPageOptions {
  cursor?: string | null;
  limit?: number;
  query?: string | null;
  category?: Memory['category'] | null;
  year?: string | null;
  month?: number | null;
}
~~~

Serialize q, year, and numeric month after limit, before cursor when present. Update useMemories(options = {}) so its query key includes a stable object containing every option and isSignedIn.

Create useMemoryFacets() with query key ['memory-facets', isSignedIn], calling /memories/facets with the owner token when signed in. Match staleTime 30_000 and retry 1.

Create useGalleryFilters() with this contract:

~~~ts
export interface GalleryFiltersController {
  filters: GalleryFilterState;
  updateFilters(
    next: GalleryFilterState,
    options?: { replace?: boolean },
  ): void;
  clearFilters(): void;
}

export function useGalleryFilters(): GalleryFiltersController;
~~~

- [ ] **Step 5: Move Gallery state inside Router context**

Split App into a BrowserRouter shell and an inner AppRoutes component so useSearchParams is called inside Router context:

~~~tsx
export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

function AppRoutes() {
  const { filters, updateFilters, clearFilters } = useGalleryFilters();
  const galleryQuery = useMemories({
    query: filters.query || null,
    category: filters.category === 'All' ? null : filters.category,
    year: filters.year || null,
    month: filters.month,
  });
}
~~~

Implement useGalleryFilters with useSearchParams, setSearchParams(toGallerySearch(next), { replace }), and a stable empty state. Reset galleryPageIndex whenever the filter identity changes. Pass totalCount from the selected MemoryPage or zero while no page has loaded.

- [ ] **Step 6: Run tests, type-check, commit, and push**

~~~powershell
npm.cmd run test -- src/lib/gallery-filters.test.ts src/lib/api.pagination.test.ts src/pages/GalleryPage.pagination.test.tsx
npm.cmd run typecheck
git add -- src/lib/gallery-filters.ts src/lib/gallery-filters.test.ts src/hooks/useGalleryFilters.ts src/hooks/useMemoryFacets.ts src/lib/api.ts src/lib/api.pagination.test.ts src/hooks/useMemories.ts src/App.tsx src/App.gallery-state.test.tsx
git commit -m "feat: connect Gallery filters to URL state"
git push origin main
~~~

---

## Task 4: Build Gallery controls and responsive filter sheet

**Files:**
- Create: src/components/gallery/GallerySearchBar.tsx
- Create: src/components/gallery/GalleryFilters.tsx
- Create: src/components/gallery/ActiveFilterSummary.tsx
- Create: src/components/gallery/MobileFilterSheet.tsx
- Create: src/components/gallery/GallerySearchBar.test.tsx
- Create: src/components/gallery/GalleryFilters.test.tsx
- Create: src/components/gallery/MobileFilterSheet.test.tsx
- Modify: src/pages/GalleryPage.tsx
- Modify: src/pages/GalleryPage.pagination.test.tsx
- Modify: src/i18n/translations.ts
- Modify: src/styles/feature-upgrades.css

**Interfaces:**
- Consumes: GalleryFilterState, MemoryFacets, totalCount, and callbacks from Task 3.
- Produces: accessible desktop controls and a shared-state mobile filter sheet.

- [ ] **Step 1: Write failing component tests**

~~~tsx
it('renders the labelled searchbox and emits the debounced query', async () => {
  const onChange = vi.fn();
  render(<GallerySearchBar value="" onChange={onChange} />);
  const input = screen.getByRole('searchbox', {
    name: 'Search titles, places, or notes',
  });
  await userEvent.type(input, '韩餐');
  await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('韩餐'));
});

it('disables Month until Year is selected', () => {
  render(<GalleryFilters state={emptyState} facets={facets} onChange={vi.fn()} />);
  expect(screen.getByRole('combobox', { name: 'Month' })).toBeDisabled();
});

it('applies mobile draft filters only after Apply', async () => {
  const onApply = vi.fn();
  render(<MobileFilterSheet state={emptyState} facets={facets} onApply={onApply} />);
  await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Year' }), '2026');
  expect(onApply).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ year: '2026' }));
});
~~~

- [ ] **Step 2: Run focused tests and verify failure**

~~~powershell
npm.cmd run test -- src/components/gallery/GallerySearchBar.test.tsx src/components/gallery/GalleryFilters.test.tsx src/components/gallery/MobileFilterSheet.test.tsx
~~~

Expected: FAIL because the new components do not exist.

- [ ] **Step 3: Implement desktop controls**

Use these props:

~~~ts
interface GallerySearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

interface GalleryFiltersProps {
  state: GalleryFilterState;
  facets: MemoryFacets | undefined;
  onChange: (next: GalleryFilterState) => void;
  onClear: () => void;
}
~~~

Render a labelled search input, category buttons with aria-pressed, labelled native year/month selects, and a Clear button. Disable Month when year is empty. Do not duplicate filter state inside the desktop controls.

- [ ] **Step 4: Implement the mobile dialog**

Render a native dialog opened by a Filters (n) button. Clone the incoming state into local draft state when opened. Apply writes the draft once; Cancel closes without changing the parent; Clear resets the draft. Use a heading, description, visible Apply/Cancel buttons, Escape close behavior, and focus return to the trigger.

- [ ] **Step 5: Integrate controls and result summary**

Replace the category-only GalleryPage props with:

~~~ts
interface GalleryPageProps {
  filters: GalleryFilterState;
  facets: MemoryFacets | undefined;
  totalCount: number;
  onFiltersChange: (next: GalleryFilterState) => void;
  onClearFilters: () => void;
  onPrefetchNextPage: () => void;
  // Existing memory, loading, error, owner, and pagination props remain.
}
~~~

Render the search bar, desktop filters, mobile trigger/sheet, result count, existing masonry grid, and existing numbered pagination. Add onFocus and onMouseEnter to the Next button to call onPrefetchNextPage; this callback must not change the visible page.

- [ ] **Step 6: Add bilingual copy and responsive styles**

Add English and Chinese keys for search labels, result counts, year/month, Clear, Filters, Apply, Cancel, no-results, share hints, and retry states. Style the desktop two-row panel, readable chips, full-width mobile search, bottom-sheet dialog, visible focus, and reduced motion in feature-upgrades.css.

- [ ] **Step 7: Run focused UI tests, type-check, commit, and push**

~~~powershell
npm.cmd run test -- src/components/gallery/GallerySearchBar.test.tsx src/components/gallery/GalleryFilters.test.tsx src/components/gallery/MobileFilterSheet.test.tsx src/pages/GalleryPage.pagination.test.tsx
npm.cmd run typecheck
git add -- src/components/gallery src/pages/GalleryPage.tsx src/pages/GalleryPage.pagination.test.tsx src/i18n/translations.ts src/styles/feature-upgrades.css
git commit -m "feat: add Gallery discovery controls"
git push origin main
~~~

---

## Task 5: Add Timeline year and month navigation

**Files:**
- Create: src/lib/timeline-navigation.ts
- Create: src/lib/timeline-navigation.test.ts
- Create: src/components/TimelineYearNav.tsx
- Create: src/components/TimelineMonthNavigator.tsx
- Create: src/components/TimelineYearNav.test.tsx
- Modify: src/pages/TimelinePage.tsx
- Modify: src/pages/TimelinePage.test.tsx
- Modify: src/pages/TimelineMonthPage.tsx
- Modify: src/pages/TimelineMonthPage.test.tsx
- Modify: src/styles/feature-upgrades.css

**Interfaces:**
- Consumes: TimelineResponse and existing parseTimelineMonthKey.
- Produces: stable year anchors and nearest non-empty month navigation for Task 6 sharing.

- [ ] **Step 1: Write failing navigation tests**

~~~ts
it('skips empty months', () => {
  const months = [
    { key: '2026-03', year: 2026, month: 3, photoCount: 8 },
    { key: '2026-04', year: 2026, month: 4, photoCount: 0 },
    { key: '2026-05', year: 2026, month: 5, photoCount: 32 },
  ];

  expect(adjacentTimelineMonths(months, '2026-03')).toEqual({
    previous: null,
    next: '2026-05',
  });
});

it('creates a stable year anchor', () => {
  expect(timelineYearAnchor(2026)).toBe('year-2026');
});
~~~

- [ ] **Step 2: Run focused tests and verify failure**

~~~powershell
npm.cmd run test -- src/lib/timeline-navigation.test.ts src/components/TimelineYearNav.test.tsx
~~~

Expected: FAIL because the helpers and components do not exist.

- [ ] **Step 3: Implement pure navigation helpers**

Create these exact exports:

~~~ts
export function timelineYearAnchor(year: number): string;
export function visibleTimelineMonths(timeline: TimelineResponse): TimelineMonth[];
export function adjacentTimelineMonths(
  months: TimelineMonth[],
  currentKey: string,
): { previous: string | null; next: string | null };
~~~

Flatten only months with photoCount greater than zero, sort by year/month ascending, and do not mutate the Timeline response.

- [ ] **Step 4: Add year anchors**

Create TimelineYearNav with years: TimelineYear[]. Each link uses href="#year-2026" and visible localized year text. Add id="year-2026" to each Timeline year section. After data renders, a matching location hash scrolls to the section. Honor prefers-reduced-motion with immediate scrolling when requested.

- [ ] **Step 5: Add month archive navigation**

In TimelineMonthPage, call useTimeline alongside useTimelineMonth. Derive adjacent non-empty keys with adjacentTimelineMonths. Render TimelineMonthNavigator above the grid and below pagination. Render only available directions at the first or last month. Keep destination page 1 and existing month pagination.

- [ ] **Step 6: Run Timeline tests, type-check, commit, and push**

~~~powershell
npm.cmd run test -- src/lib/timeline-navigation.test.ts src/components/TimelineYearNav.test.tsx src/pages/TimelinePage.test.tsx src/pages/TimelineMonthPage.test.tsx
npm.cmd run typecheck
git add -- src/lib/timeline-navigation.ts src/lib/timeline-navigation.test.ts src/components/TimelineYearNav.tsx src/components/TimelineMonthNavigator.tsx src/components/TimelineYearNav.test.tsx src/pages/TimelinePage.tsx src/pages/TimelinePage.test.tsx src/pages/TimelineMonthPage.tsx src/pages/TimelineMonthPage.test.tsx src/styles/feature-upgrades.css
git commit -m "feat: add Timeline year and month navigation"
git push origin main
~~~

---

## Task 6: Add public link sharing

**Files:**
- Create: src/lib/share-link.ts
- Create: src/lib/share-link.test.ts
- Create: src/components/ShareLinkButton.tsx
- Create: src/components/ShareLinkButton.test.tsx
- Modify: src/pages/GalleryPage.tsx
- Modify: src/pages/TimelinePage.tsx
- Modify: src/pages/TimelineMonthPage.tsx
- Modify: src/pages/MemoryDetailPage.tsx
- Modify: src/i18n/translations.ts
- Modify: src/styles/feature-upgrades.css

**Interfaces:**
- Consumes: canonical Gallery URL state from Task 3 and Timeline anchors from Task 5.
- Produces: reusable link-only share behavior with clipboard fallback.

- [ ] **Step 1: Write failing share tests**

~~~ts
it('uses Web Share API when available', async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { share });

  await shareLink({
    title: 'April memories',
    url: 'https://lucyandalan.com/timeline/2026-04',
  });

  expect(share).toHaveBeenCalledWith({
    title: 'April memories',
    text: 'April memories',
    url: 'https://lucyandalan.com/timeline/2026-04',
  });
});

it('copies the URL when Web Share is unavailable', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } });

  await shareLink({
    title: '2026',
    url: 'https://lucyandalan.com/timeline#year-2026',
  });

  expect(writeText).toHaveBeenCalledWith(
    'https://lucyandalan.com/timeline#year-2026',
  );
});
~~~

- [ ] **Step 2: Run focused tests and verify failure**

~~~powershell
npm.cmd run test -- src/lib/share-link.test.ts src/components/ShareLinkButton.test.tsx
~~~

Expected: FAIL because the helper and component do not exist.

- [ ] **Step 3: Implement link-only sharing**

Create this exact helper contract:

~~~ts
export interface ShareLinkInput {
  title: string;
  url: string;
}

export type ShareLinkResult = 'shared' | 'copied' | 'manual';

export async function shareLink(input: ShareLinkInput): Promise<ShareLinkResult>;
~~~

Call navigator.share first when available. If the user cancels, return manual without an error toast. If share is unavailable, call navigator.clipboard.writeText. If clipboard fails, return manual and let the component reveal a selected read-only URL field. Never attach Clerk tokens or asset URLs.

Create ShareLinkButton with title, url, label, copiedLabel, and fallbackLabel props.

- [ ] **Step 4: Place share actions**

Use these canonical targets:

~~~ts
const galleryUrl = window.location.origin + '/gallery' + toGallerySearch(filters);
const yearUrl = window.location.origin + '/timeline#year-' + year.year;
const monthUrl = window.location.origin + '/timeline/' + month.key;
const memoryUrl = window.location.origin + '/memory/' + encodeURIComponent(memory.id);
~~~

Place Gallery sharing in the discovery panel, year sharing in each Timeline heading, month sharing in the archive heading, and memory sharing in the detail heading. Add the hint that visitors see only public memories when an owner shares a filtered Gallery URL.

- [ ] **Step 5: Add bilingual feedback and styles**

Add translations for Share, Link copied, Copy link manually, and the public-only sharing hint. Use aria-live="polite", preserve visible focus, and keep fallback URLs keyboard-selectable.

- [ ] **Step 6: Run tests, type-check, commit, and push**

~~~powershell
npm.cmd run test -- src/lib/share-link.test.ts src/components/ShareLinkButton.test.tsx src/pages/TimelinePage.test.tsx src/pages/TimelineMonthPage.test.tsx
npm.cmd run typecheck
git add -- src/lib/share-link.ts src/lib/share-link.test.ts src/components/ShareLinkButton.tsx src/components/ShareLinkButton.test.tsx src/pages/GalleryPage.tsx src/pages/TimelinePage.tsx src/pages/TimelineMonthPage.tsx src/pages/MemoryDetailPage.tsx src/i18n/translations.ts src/styles/feature-upgrades.css
git commit -m "feat: add public memory link sharing"
git push origin main
~~~

---

## Task 7: Add dimensions, priority loading, and mobile/performance polish

**Files:**
- Modify: shared/contracts.ts
- Modify: worker/lib/memories.ts
- Modify: worker/lib/memories.pagination.test.ts
- Modify: src/components/DerivativeImage.tsx
- Modify: src/components/DerivativeImage.test.tsx
- Modify: src/components/MemoryCard.tsx
- Modify: src/components/MemoryCard.test.tsx
- Modify: src/components/TimelinePhoto.tsx
- Modify: src/hooks/useMemories.ts
- Modify: src/pages/GalleryPage.tsx
- Modify: src/styles/feature-upgrades.css
- Modify: src/styles/global.css

**Interfaces:**
- Consumes: existing nullable media_assets.width and media_assets.height columns.
- Produces: stable card dimensions, controlled first-page priority, idle next-page prefetch, and reduced-motion/mobile polish.

- [ ] **Step 1: Write failing dimension and loading tests**

~~~tsx
it('passes image dimensions to DerivativeImage', () => {
  render(<MemoryCard memory={memoryWithImageDimensions} isOwner={false} />);
  expect(screen.getByRole('img', {
    name: memoryWithImageDimensions.title,
  })).toHaveAttribute('width', '1200')
    .toHaveAttribute('height', '1600');
});

it('keeps non-priority images lazy', () => {
  render(<DerivativeImage src="/thumb" alt="memory" loading="lazy" />);
  expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy');
});
~~~

- [ ] **Step 2: Run focused tests and verify failure**

~~~powershell
npm.cmd run test -- src/components/DerivativeImage.test.tsx src/components/MemoryCard.test.tsx worker/lib/memories.pagination.test.ts
~~~

Expected: FAIL because dimensions are not in the contract or aggregated response.

- [ ] **Step 3: Add nullable dimensions to contracts and Worker aggregation**

Extend ImageAsset:

~~~ts
width: number | null;
height: number | null;
~~~

Add a.width and a.height to the joined memory row and pass them through aggregateMemories. Update image fixtures with dimensions or null.

- [ ] **Step 4: Reserve image space and control priority**

Pass width and height from MemoryCard to DerivativeImage. Use fetchPriority="high" only for the first two visible Gallery cards on the initial result page and loading="lazy" for the rest. Keep the first Timeline year cover eager.

Add:

~~~css
.memory-card {
  content-visibility: auto;
  contain-intrinsic-size: 360px 460px;
}

.derivative-image img {
  aspect-ratio: auto;
}
~~~

If dimensions are null, preserve the current CSS fallback. Do not use object-fit: cover for full image detail.

- [ ] **Step 5: Prefetch the next page without changing the visible page**

Add onPrefetchNextPage to GalleryPage and invoke it on Next-button focus/mouseenter. In AppRoutes, call galleryQuery.fetchNextPage() only when the current page is the last loaded page, a next page exists, the query is idle, and navigator.connection?.saveData is not true. Do not change galleryPageIndex during prefetch.

- [ ] **Step 6: Finish responsive and reduced-motion rules**

Add mobile styles for the discovery panel, filter dialog, month navigation, and share controls at the existing 620px and 900px breakpoints. Add:

~~~css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
~~~

Keep new buttons at least 44px in both dimensions and preserve the existing one-column narrow-phone grid.

- [ ] **Step 7: Run tests, type-check, commit, and push**

~~~powershell
npm.cmd run test -- src/components/DerivativeImage.test.tsx src/components/MemoryCard.test.tsx worker/lib/memories.pagination.test.ts src/pages/GalleryPage.pagination.test.tsx
npm.cmd run typecheck
git add -- shared/contracts.ts worker/lib/memories.ts worker/lib/memories.pagination.test.ts src/components/DerivativeImage.tsx src/components/DerivativeImage.test.tsx src/components/MemoryCard.tsx src/components/MemoryCard.test.tsx src/components/TimelinePhoto.tsx src/hooks/useMemories.ts src/pages/GalleryPage.tsx src/styles/feature-upgrades.css src/styles/global.css
git commit -m "perf: stabilize memory image loading"
git push origin main
~~~

---

## Task 8: Full verification, production acceptance, and release handoff

**Files:**
- Modify only files required by a failing regression test from Tasks 1–7.
- Do not change the approved design document or this plan during verification unless a concrete test exposes a contradiction.

**Interfaces:**
- Consumes: completed Tasks 1–7 and the deployed main build.
- Produces: a verified release candidate and deployment/acceptance report.

- [ ] **Step 1: Run the complete local sequence**

~~~powershell
npm.cmd run check
npm.cmd run build
git diff --check
git status --short --branch
~~~

Expected: TypeScript, all Vitest files, Vite build, and whitespace checks pass; the working tree is clean and main matches origin/main.

- [ ] **Step 2: Perform production privacy/API checks**

As a guest, verify:

~~~text
GET /api/memories?q=韩餐&year=2026&month=5
GET /api/memories/facets
GET /timeline
GET /timeline/2026-04
~~~

Confirm that responses contain only published memories with public assets and no private original URL, Clerk token, or owner identifier.

- [ ] **Step 3: Perform browser acceptance at desktop and mobile sizes**

Verify:

1. Search by title, location, and description.
2. Combine query, category, year, and month.
3. Clear one filter and Clear All.
4. Navigate Gallery pages without old results appearing in the new filter set.
5. Refresh and use Back/Forward; filters remain, and refresh/share opens page 1.
6. Use the mobile filter sheet with Apply, Cancel, Escape, and focus return.
7. Jump between Timeline years.
8. Navigate from April to the nearest non-empty prior/next month.
9. Copy/share Gallery, year, month, and memory links.
10. Open an owner-filtered Gallery link as a guest and confirm private memories are absent.
11. Verify image space is reserved and non-priority cards stay lazy.
12. Verify keyboard focus and reduced-motion behavior.

- [ ] **Step 4: Commit only regression fixes and push**

If verification exposes a concrete regression, add its failing test first, apply the minimal fix, rerun the affected suite plus the full check/build, then run:

~~~powershell
$changedFiles = git diff --name-only
if (-not $changedFiles) { throw 'No regression files are present to commit.' }
git add -- $changedFiles
git commit -m "fix: resolve memory discovery regression"
git push origin main
~~~

- [ ] **Step 5: Deploy only after the release candidate is green**

After local and browser verification are green and the user confirms deployment, run:

~~~powershell
npm.cmd run deploy
~~~

Recheck /gallery, /timeline, /timeline/2026-04, and a shared Gallery URL in the user's browser. Report the deployed commit, test/build results, and remaining non-blocking observations.
