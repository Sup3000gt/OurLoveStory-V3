# Clerk and Cloudflare Production Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace demo authentication and static memory data with two-owner Clerk authentication, a Cloudflare Worker API, D1 metadata, private R2 media, direct uploads, and authorized original downloads.

**Architecture:** The React SPA uses Clerk for identity and React Query for API state. A same-origin Cloudflare Worker verifies Clerk session tokens and a D1 owner allowlist, issues five-minute R2 presigned PUT URLs, stores memory metadata transactionally in D1, and streams public/private R2 objects after server-side authorization. Static assets remain served by Cloudflare Workers Static Assets, with `/api/*` routed to the Worker first.

**Tech Stack:** React 19, TypeScript, Vite, `@clerk/react`, `@clerk/backend`, TanStack Query, Cloudflare Workers, D1, R2, `aws4fetch`, Vitest.

## Global Constraints

- Public registration remains disabled in Clerk; only two manually created users are inserted into the D1 `owners` allowlist.
- A signed-in Clerk user is not an owner until their Clerk user ID exists in D1.
- Private media never receives a permanent public URL and unauthorized private resource requests return 404.
- Uploads go directly from the browser to R2 using five-minute presigned URLs restricted to the declared `Content-Type`.
- Supported first-release media types are JPEG, PNG, WebP, GIF, MP4, QuickTime MOV, and WebM.
- Each memory may contain up to 20 assets; images may be up to 50 MiB and videos up to 2 GiB each.
- Every asset has an authorized inline endpoint and an original-download endpoint.
- No credentials, private media, or real owner IDs are committed.

---

### Task 1: Shared contracts and validation

**Files:**
- Create: `shared/contracts.ts`
- Create: `worker/lib/validation.ts`
- Create: `worker/lib/validation.test.ts`
- Modify: `src/data/memories.ts`

- [ ] Define the public memory, asset, upload authorization, memory creation, and owner-session contracts.
- [ ] Add tests for supported MIME types, file limits, required metadata, path ownership, and filename sanitization.
- [ ] Implement minimal validation helpers and run tests.

### Task 2: Clerk owner authentication

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/Header.tsx`
- Create: `src/components/ConfigurationRequired.tsx`
- Create: `src/hooks/useOwnerSession.ts`
- Create: `src/lib/api.ts`
- Create: `worker/lib/auth.ts`

- [ ] Configure `ClerkProvider` and remove demo sign-in state.
- [ ] Add real sign-in modal, user button, owner-session query, and protected Studio behavior.
- [ ] Verify backend authentication from Authorization bearer token or Clerk `__session` cookie and D1 allowlist.

### Task 3: D1 memory API and authorized R2 delivery

**Files:**
- Create: `worker/index.ts`
- Create: `worker/lib/memories.ts`
- Create: `worker/lib/responses.ts`
- Modify: `database/schema.sql`
- Modify: `API_CONTRACT.md`

- [ ] Implement `/api/health`, `/api/session`, and owner-aware `GET /api/memories`.
- [ ] Implement public/private inline asset streaming with range support and original downloads.
- [ ] Implement memory create, edit, and delete with D1 transactions and R2 cleanup.

### Task 4: Direct R2 upload and Owner Studio

**Files:**
- Create: `worker/lib/uploads.ts`
- Modify: `src/pages/StudioPage.tsx`
- Create: `src/hooks/useMemories.ts`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/GalleryPage.tsx`
- Modify: `src/components/MemoryCard.tsx`
- Create: `src/pages/MemoryDetailPage.tsx`

- [ ] Issue owner-only R2 presigned PUT URLs with server-generated object keys.
- [ ] Upload selected files directly to R2, then publish or save the memory as a draft.
- [ ] Select a cover asset, clean up object URLs, show upload state, and invalidate memory queries.
- [ ] Render images and videos and provide a per-asset original download on the detail page.

### Task 5: Cloudflare configuration, CI, and setup documentation

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `wrangler.toml`
- Modify: `tsconfig.json`
- Create: `tsconfig.worker.json`
- Create: `.github/workflows/ci.yml`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] Enable the Cloudflare Vite plugin and route `/api/*` to `worker/index.ts` before static assets.
- [ ] Document Clerk restricted sign-up, two-user D1 allowlist, R2 API credentials, bucket CORS, secrets, local development, and deployment.
- [ ] Run validation tests, TypeScript checks, unit tests, and production build; create a PR only after verification.
