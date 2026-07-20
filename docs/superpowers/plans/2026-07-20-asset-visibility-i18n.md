# Per-Asset Visibility and Bilingual UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independent Public/Private visibility to every photo and video, default all new uploads to Private, and add a natural Chinese/English interface switch.

**Architecture:** D1 stores visibility on `media_assets`; Worker queries filter assets before data leaves the server and resolve a guest-safe cover. React uses a small typed translation context and optimistic React Query updates for owner visibility switches.

**Tech Stack:** React 19, TypeScript, TanStack Query, Clerk, Cloudflare Workers, D1, R2, Vitest.

## Global Constraints

- New uploads default every asset to `private`.
- Guest responses never include Private asset metadata or URLs.
- A public Memory remains one card and contains only its Public assets for guests.
- Owners see all assets and can toggle each asset independently.
- User-entered titles, locations, descriptions, and filenames are never translated.
- Existing assets inherit their current Memory visibility during migration.
- `memories.visibility` remains temporarily for compatibility.
- No automatic production migration, commit, push, or deployment from the implementation script.

---

### Task 1: Add the asset visibility schema and contracts

**Files:**
- Modify: `database/schema.sql`
- Create: `database/migrations/0002_asset_visibility.sql`
- Modify: `shared/contracts.ts`
- Modify: `worker/lib/validation.test.ts`
- Modify: `worker/lib/validation.ts`

- [ ] Write failing validation tests for default Private and invalid visibility.
- [ ] Add `media_assets.visibility`, migration inheritance, and index.
- [ ] Add visibility to asset request/response contracts.
- [ ] Run `npm run test -- worker/lib/validation.test.ts`.

### Task 2: Enforce visibility in Worker reads and downloads

**Files:**
- Create: `worker/lib/asset-visibility.test.ts`
- Create: `worker/lib/asset-visibility.ts`
- Modify: `worker/lib/memories.ts`
- Modify: `worker/index.ts`

- [ ] Write failing tests for guest cover fallback.
- [ ] Filter guest SQL by `m.status = 'published' AND a.visibility = 'public'`.
- [ ] Return all assets to owners and Public-only assets to guests.
- [ ] Use Asset visibility for inline/download authorization.
- [ ] Add owner-only `PATCH /api/assets/:assetId`.
- [ ] Run Worker tests.

### Task 3: Add frontend visibility state and optimistic updates

**Files:**
- Modify: `src/lib/api.ts`
- Create: `src/lib/memory-visibility.test.ts`
- Create: `src/lib/memory-visibility.ts`
- Modify: `src/components/GalleryGrid.tsx`
- Modify: `src/components/MemoryCard.tsx`
- Modify: `src/pages/MemoryDetailPage.tsx`
- Modify: `src/pages/StudioPage.tsx`
- Modify: `src/App.tsx`

- [ ] Write failing tests for counts and immutable visibility replacement.
- [ ] Default each selected upload to Private.
- [ ] Submit per-asset visibility in `CreateMemoryRequest`.
- [ ] Add owner-only per-asset toggles with optimistic update and rollback.
- [ ] Show Public/Private counts on owner cards.
- [ ] Run frontend tests.

### Task 4: Add typed Chinese/English localization

**Files:**
- Create: `src/i18n/translations.test.ts`
- Create: `src/i18n/translations.ts`
- Create: `src/i18n/LanguageProvider.tsx`
- Create: `src/i18n/useTranslation.ts`
- Modify: `src/main.tsx`
- Modify: `src/components/Brand.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/ConfigurationRequired.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/GalleryPage.tsx`
- Modify: `src/pages/MemoryDetailPage.tsx`
- Modify: `src/pages/StudioPage.tsx`
- Modify: `src/lib/format.ts`
- Modify: `src/lib/format.test.ts`

- [ ] Write failing language selection, interpolation, and Chinese date tests.
- [ ] Add localStorage/browser-language initialization.
- [ ] Add `中文 / EN` to the header.
- [ ] Translate all static interface copy with natural Chinese.
- [ ] Keep user content unchanged.
- [ ] Run i18n and format tests.

### Task 5: Style and full verification

**Files:**
- Create: `src/styles/feature-upgrades.css`
- Modify: `src/App.tsx`

- [ ] Style language and visibility controls responsively.
- [ ] Run `npm run check`.
- [ ] Run `npm run build`.
- [ ] Review `git diff --check`.
- [ ] Review the site locally with `npm run dev`.
- [ ] Run the production D1 migration before deploying the new Worker.
