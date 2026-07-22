# Phase 3A Secure Image Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace direct image-original browsing with secure Thumbnail and Preview derivatives, add real Upload Session thumbnails, and complete a two-release cutover that makes image originals Owner-only without changing video behavior.

**Architecture:** Keep originals and deterministic versioned derivatives in the existing R2 bucket. Use the Cloudflare Images binding for sources up to 20 MB and a 60-second HMAC-signed internal source URL with `cf.image` remote transformation for sources above 20 MB through 100 MB. Check D1 access before any R2 read, promote Session thumbnails after confirmation, and keep Release 1 legacy image routes intact until production smoke testing authorizes Release 2.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Vitest 3, Cloudflare Workers, D1, R2, Cloudflare Images binding, Clerk, TanStack Query.

## Global Constraints

- Work only in `D:\Downloads\OurLoveStory-V3-phase3-secure-image-delivery` on branch `feature/phase3a-secure-image-delivery`.
- Expected starting commit is `2b0e17b`.
- Do not modify `main`, push, merge, deploy, create D1 migrations, or mutate production R2 without an explicit release gate.
- Thumbnail: WebP, max 640×640, quality 75, `fit: "scale-down"`, `anim: false`.
- Preview: WebP, max 2048×2048, quality 82, `fit: "scale-down"`, `anim: false`.
- Final keys: `derivatives/v1/assets/<assetId>/<variant>.webp`.
- Session key: `derivatives/v1/upload-sessions/<sessionId>/<sessionFileId>/thumbnail.webp`.
- Guest may read only Published + Public derivatives.
- Guest may never read image Original bytes or receive a non-null image Original URL.
- Unauthorized image and Session resources return 404.
- Public derivative: `public, no-cache, must-revalidate`.
- Private/Draft derivative and Original: `private, no-store`.
- Generation failure returns 503 + `Retry-After: 5` and never falls back to Original.
- Do not add D1 derivative status.
- Video behavior remains unchanged.
- Do not accept HEIC/HEIF yet.
- Do not enable paid billing automatically.
- Never commit `IMAGE_SOURCE_SIGNING_KEY` or other secrets.
- Use TDD and a focused commit per Task.
- Stop after Release 1 hardening. Release 2 requires successful production smoke testing and explicit approval.

## File Map

- `shared/contracts.ts`: Release 1 dual-delivery and Release 2 final image/video union.
- `worker/env.ts`, `wrangler.toml`: Images binding and signing-secret type.
- `worker/lib/image-derivatives.ts`: variants, limits, keys, cache and ETag helpers.
- `worker/lib/image-source-signature.ts`: HMAC signed source URLs.
- `worker/lib/image-transformer.ts`: binding/remote transformation, R2 persistence, in-isolate dedupe.
- `worker/lib/image-delivery.ts`: Asset access, derivative/original responses, signed source streaming.
- `worker/lib/image-routes.ts`: route parser/dispatcher.
- `worker/lib/image-session-lifecycle.ts`: Session promotion and derivative cleanup.
- `worker/lib/memories.ts`: contract mapping and Asset/Memory deletion.
- `worker/lib/upload-session-routes.ts`, `worker/lib/upload-session-service.ts`: Session Thumbnail and confirmation lifecycle.
- `src/lib/image-assets.ts`: image/video helpers and Session Thumbnail URL.
- `src/components/DerivativeImage.tsx`: safe image + Retry.
- `src/components/ImageLightbox.tsx`: Thumbnail-to-Preview progressive lightbox.
- `src/components/MemoryCard.tsx`, `src/pages/MemoryDetailPage.tsx`: optimized delivery.
- `src/pages/UploadSessionReviewPage.tsx`, upload Review components: persisted Session Thumbnail.
- `src/i18n/translations.ts`, `src/styles/feature-upgrades.css`: copy and presentation.

---

### Task 1: Image derivative primitives and binding

**Files:**
- Create: `worker/lib/image-derivatives.ts`
- Create: `worker/lib/image-derivatives.test.ts`
- Modify: `worker/env.ts`
- Modify: `wrangler.toml`

**Interfaces:**
- Produces `ImageDerivativeVariant`, `ImageVariantConfig`, `imageVariantConfig`, `assetDerivativeKey`, `sessionThumbnailKey`, `shouldUseBinding`, `isRemoteTransformSizeSupported`, `derivativeCacheControl`, `ifNoneMatchMatches`.

- [ ] **Step 1: Write RED tests**

Test exact configs:

```ts
expect(imageVariantConfig('thumbnail')).toEqual({
  width: 640,
  height: 640,
  fit: 'scale-down',
  format: 'webp',
  bindingFormat: 'image/webp',
  quality: 75,
  anim: false,
});
expect(imageVariantConfig('preview').width).toBe(2048);
expect(assetDerivativeKey('a', 'preview'))
  .toBe('derivatives/v1/assets/a/preview.webp');
expect(sessionThumbnailKey('s', 'f'))
  .toBe('derivatives/v1/upload-sessions/s/f/thumbnail.webp');
expect(shouldUseBinding(20 * 1024 * 1024)).toBe(true);
expect(shouldUseBinding(20 * 1024 * 1024 + 1)).toBe(false);
expect(isRemoteTransformSizeSupported(100 * 1024 * 1024)).toBe(true);
```

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test -- worker/lib/image-derivatives.test.ts
```

Expected: missing module.

- [ ] **Step 3: Implement primitives**

Use:

```ts
export type ImageDerivativeVariant = 'thumbnail' | 'preview';

export interface ImageVariantConfig {
  width: number;
  height: number;
  fit: 'scale-down';
  format: 'webp';
  bindingFormat: 'image/webp';
  quality: number;
  anim: false;
}
```

Use fixed `Record<ImageDerivativeVariant, ImageVariantConfig>`, 20 MiB and 100 MiB constants, deterministic `v1` keys, and exact cache values from Global Constraints.

Add to `worker/env.ts`:

```ts
IMAGES: ImagesBinding;
IMAGE_SOURCE_SIGNING_KEY: string;
```

Add to `wrangler.toml`:

```toml
[images]
binding = "IMAGES"
```

Do not add the secret under `[vars]`.

- [ ] **Step 4: Verify GREEN**

```powershell
npm.cmd run typecheck
npm.cmd run test -- worker/lib/image-derivatives.test.ts
npm.cmd exec wrangler -- deploy --dry-run
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add worker/lib/image-derivatives.ts worker/lib/image-derivatives.test.ts worker/env.ts wrangler.toml
git commit -m "feat: add image derivative primitives"
```

---

### Task 2: HMAC signed internal source URLs

**Files:**
- Create: `worker/lib/image-source-signature.ts`
- Create: `worker/lib/image-source-signature.test.ts`

**Interfaces:**
- Produces `canonicalImageSource`, `signImageSource`, `verifyImageSourceSignature`, `signedImageSourceUrl`.

- [ ] **Step 1: Write RED tests**

Test:
- canonical value is `pathname + "\n" + expires`;
- valid HMAC verifies;
- changed path fails;
- expired signature fails;
- expiry beyond 60 seconds fails;
- generated URL includes expiry/signature but not secret.

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test -- worker/lib/image-source-signature.test.ts
```

- [ ] **Step 3: Implement with Web Crypto**

Required signatures:

```ts
export async function signImageSource(
  secret: string,
  pathname: string,
  expires: number,
): Promise<string>;

export async function verifyImageSourceSignature(
  secret: string,
  pathname: string,
  expires: number,
  signature: string,
  nowSeconds: number,
): Promise<boolean>;

export async function signedImageSourceUrl(
  origin: string,
  pathname: string,
  secret: string,
  nowSeconds: number,
): Promise<{
  url: string;
  expires: number;
  signature: string;
}>;
```

Use HMAC-SHA256, base64url, `crypto.subtle.verify`, and max TTL 60 seconds.

- [ ] **Step 4: Verify GREEN**

```powershell
npm.cmd run typecheck
npm.cmd run test -- worker/lib/image-source-signature.test.ts
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add worker/lib/image-source-signature.ts worker/lib/image-source-signature.test.ts
git commit -m "feat: sign private image source requests"
```

---

### Task 3: Hybrid persistent transformer

**Files:**
- Create: `worker/lib/image-transformer.ts`
- Create: `worker/lib/image-transformer.test.ts`
- Modify: `worker/lib/structured-log.ts` only when its types require new fields.

**Interfaces:**
- Produces `ImageSourceDescriptor`, `GeneratedDerivative`, `ImageDerivativeError`, `generateAndPersistDerivative`, `readOrGenerateDerivative`.

- [ ] **Step 1: Write RED tests**

Test:
- exactly 20 MB uses `env.IMAGES.input(stream)`;
- above 20 MB uses injected `fetchImpl(url, { cf: { image } })`;
- above 100 MB throws `SOURCE_TOO_LARGE` before R2 body read;
- binding options use width/height/scale-down and output WebP quality/anim;
- remote options use WebP, quality, scale-down, anim false;
- bytes persist to the requested R2 key with `image/webp`;
- two concurrent calls for one key share one Promise;
- non-OK remote response maps to `REMOTE_FAILED`;
- Cloudflare error 9422 maps to `QUOTA_EXCEEDED`.

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test -- worker/lib/image-transformer.test.ts
```

- [ ] **Step 3: Implement**

Use:

```ts
export type ImageSourceDescriptor =
  | {
      kind: 'asset';
      assetId: string;
      objectKey: string;
      sizeBytes: number;
    }
  | {
      kind: 'upload-session';
      sessionId: string;
      sessionFileId: string;
      objectKey: string;
      sizeBytes: number;
    };
```

Use module-level:

```ts
const inFlight =
  new Map<string, Promise<GeneratedDerivative>>();
```

Binding path:

```ts
(
  await env.IMAGES
    .input(original.body)
    .transform({
      width: config.width,
      height: config.height,
      fit: config.fit,
    })
    .output({
      format: config.bindingFormat,
      quality: config.quality,
      anim: config.anim,
    })
).response();
```

Remote path:
- build a signed internal source URL;
- call injected/global `fetch` with `cf.image`;
- never log the URL or signature.

Persist with R2 `put`, `contentType: image/webp`, and custom metadata for version/source/variant. Always remove the in-flight Promise in `finally`.

- [ ] **Step 4: Verify GREEN**

```powershell
npm.cmd run typecheck
npm.cmd run test -- worker/lib/image-transformer.test.ts worker/lib/image-derivatives.test.ts worker/lib/image-source-signature.test.ts
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add worker/lib/image-transformer.ts worker/lib/image-transformer.test.ts worker/lib/structured-log.ts
git commit -m "feat: persist optimized image derivatives"
```

---

### Task 4: Release 1 Asset routes and dual-delivery contract

**Files:**
- Create: `worker/lib/image-delivery.ts`
- Create: `worker/lib/image-delivery.test.ts`
- Create: `worker/lib/image-routes.ts`
- Create: `worker/lib/image-routes.test.ts`
- Modify: `worker/index.ts`
- Modify: `worker/lib/memories.ts`
- Modify: `shared/contracts.ts`
- Modify: `worker/lib/asset-visibility.test.ts`
- Modify: `src/lib/memory-assets.test.ts`

**Interfaces:**
- Produces `matchImageRoute`, `handleImageRoute`, `serveImageDerivative`, `serveImageOriginal`, `serveSignedInternalImageSource`.
- Release 1 `ImageAsset` includes new fields plus legacy `url` and `downloadUrl`.
- `VideoAsset` stays unchanged.

- [ ] **Step 1: Write RED tests**

Route parser covers:

```text
/api/assets/a/thumbnail
/api/assets/a/preview
/api/assets/a/original
/api/internal/image-source/assets/a
/api/internal/image-source/upload-sessions/s/files/f
```

Delivery tests:
- Owner reads Public/Private derivative.
- Guest reads Published + Public.
- Guest Private and Draft return 404 before R2 access.
- Guest Original returns 404.
- Owner Original supports HEAD and Range.
- valid signed source streams exact Original with `private, no-store`;
- invalid/expired signature returns 404;
- matching ETag returns 304;
- generation failure returns 503 + Retry-After 5.

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test -- worker/lib/image-routes.test.ts worker/lib/image-delivery.test.ts
```

- [ ] **Step 3: Implement Release 1**

Define:

```ts
export interface ImageAsset {
  type: 'image';
  id: string;
  thumbnailUrl: string;
  previewUrl: string;
  originalUrl: string | null;
  url: string;
  downloadUrl: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  visibility: Visibility;
}

export interface VideoAsset {
  type: 'video';
  id: string;
  url: string;
  downloadUrl: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  visibility: Visibility;
}

export type MemoryAsset = ImageAsset | VideoAsset;
```

Map image JSON:
- Thumbnail/Preview always present;
- `originalUrl` only for Owner;
- legacy `url`/`downloadUrl` retained during Release 1.

Query Asset descriptor with media type, object key, original metadata, visibility, and Memory status.

Route ordering in `worker/index.ts`:
1. health/session;
2. signed/new image routes;
3. Upload Session routes;
4. legacy Asset routes.

Keep legacy `serveAsset()` behavior unchanged in Release 1.

- [ ] **Step 4: Verify GREEN**

```powershell
npm.cmd run typecheck
npm.cmd run test -- worker/lib/image-routes.test.ts worker/lib/image-delivery.test.ts worker/lib/asset-visibility.test.ts src/lib/memory-assets.test.ts
npm.cmd run check
npm.cmd run build
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add shared/contracts.ts worker/index.ts worker/lib/image-delivery.ts worker/lib/image-delivery.test.ts worker/lib/image-routes.ts worker/lib/image-routes.test.ts worker/lib/memories.ts worker/lib/asset-visibility.test.ts src/lib/memory-assets.test.ts
git commit -m "feat: add secure image delivery routes"
```

---

### Task 5: Owned Upload Session Thumbnail route

**Files:**
- Modify: `worker/lib/upload-session-routes.ts`
- Modify: `worker/lib/upload-session-routes.test.ts`
- Modify: `worker/lib/upload-session-service.ts`
- Create: `worker/lib/upload-session-thumbnail.test.ts`

**Interfaces:**
- Adds `GET|HEAD /api/upload-sessions/:sessionId/files/:fileId/thumbnail`.

- [ ] **Step 1: Write RED tests**

Parser expectation:

```ts
expect(matchUploadSessionRoute(
  '/api/upload-sessions/s/files/f/thumbnail',
)).toEqual({
  action: 'thumbnail',
  sessionId: 's',
  fileId: 'f',
});
```

Service tests:
- owned uploaded file works;
- other Owner returns 404;
- pending/failed/skipped file returns 404;
- missing Original returns 404;
- HEAD has no body;
- second request reads the stored Session derivative.

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test -- worker/lib/upload-session-routes.test.ts worker/lib/upload-session-thumbnail.test.ts
```

- [ ] **Step 3: Implement**

Add route action:

```ts
| {
    action: 'thumbnail';
    sessionId: string;
    fileId: string;
  }
```

Require Owner, owned file, `uploaded` status, and non-null object key. Use the Session derivative key and Task 3 transformer. Always return `private, no-store`.

- [ ] **Step 4: Verify GREEN**

```powershell
npm.cmd run typecheck
npm.cmd run test -- worker/lib/upload-session-routes.test.ts worker/lib/upload-session-thumbnail.test.ts
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add worker/lib/upload-session-routes.ts worker/lib/upload-session-routes.test.ts worker/lib/upload-session-service.ts worker/lib/upload-session-thumbnail.test.ts
git commit -m "feat: add upload session thumbnails"
```

---

### Task 6: Promotion and cleanup lifecycle

**Files:**
- Create: `worker/lib/image-session-lifecycle.ts`
- Create: `worker/lib/image-session-lifecycle.test.ts`
- Modify: `worker/lib/upload-session-service.ts`
- Modify: `worker/lib/upload-session-service.integration.test.ts`
- Modify: `worker/lib/memories.ts`
- Modify: `worker/lib/asset-deletion.test.ts`

**Interfaces:**
- Produces `ConfirmedImageMapping`, `finalizeConfirmedImages`, `deleteSessionImageObjects`, `imageAssetObjectKeys`.

- [ ] **Step 1: Write RED tests**

Assert:
- Session Thumbnail copies to final Thumbnail key;
- copied Session Thumbnail is deleted;
- Preview generation is scheduled;
- absent Session Thumbnail triggers final Thumbnail generation;
- post-confirm derivative failure does not reject confirmation;
- Abandon deletes Original and Session Thumbnail;
- delete Asset deletes Original + two final image derivatives;
- delete Memory deletes all image derivatives and leaves video cleanup unchanged.

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test -- worker/lib/image-session-lifecycle.test.ts worker/lib/upload-session-service.integration.test.ts worker/lib/asset-deletion.test.ts
```

- [ ] **Step 3: Implement**

Use:

```ts
export interface ConfirmedImageMapping {
  sessionId: string;
  sessionFileId: string;
  assetId: string;
  objectKey: string;
  sizeBytes: number;
}
```

Refactor Create/Append confirmation helpers to return `{ memory, mappings }`.

Change confirmation signature to accept `ctx` and `origin`:

```ts
confirmUploadSession(
  env,
  owner,
  sessionId,
  requestId,
  ctx,
  origin,
)
```

Schedule `finalizeConfirmedImages()` only after D1 confirmation succeeds. Use bounded concurrency 3 and `Promise.allSettled`. Never roll back a confirmed Memory for derivative failure.

Add deterministic derivative keys to Abandon, Asset deletion, and Memory deletion.

- [ ] **Step 4: Verify GREEN**

```powershell
npm.cmd run typecheck
npm.cmd run test -- worker/lib/image-session-lifecycle.test.ts worker/lib/upload-session-service.integration.test.ts worker/lib/asset-deletion.test.ts
npm.cmd run check
npm.cmd run build
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add worker/lib/image-session-lifecycle.ts worker/lib/image-session-lifecycle.test.ts worker/lib/upload-session-service.ts worker/lib/upload-session-service.integration.test.ts worker/lib/memories.ts worker/lib/asset-deletion.test.ts
git commit -m "feat: manage image derivative lifecycle"
```

---

### Task 7: Reusable optimized image UI

**Files:**
- Create: `src/lib/image-assets.ts`
- Create: `src/lib/image-assets.test.ts`
- Create: `src/components/DerivativeImage.tsx`
- Create: `src/components/DerivativeImage.test.tsx`
- Create: `src/components/ImageLightbox.tsx`
- Create: `src/components/ImageLightbox.test.tsx`
- Modify: `src/i18n/translations.ts`
- Modify: `src/i18n/translations.test.ts`
- Modify: `src/styles/feature-upgrades.css`

**Interfaces:**
- Produces `isImageAsset`, `assetNormalDownloadUrl`, `sessionThumbnailUrl`, `appendRetryNonce`, `DerivativeImage`, `ImageLightbox`.

- [ ] **Step 1: Write RED tests**

Assert:
- image Owner download uses `originalUrl`;
- Guest image download is null;
- video download remains `downloadUrl`;
- Session URL encodes IDs;
- DerivativeImage initial `src` is the derivative;
- error shows safe message and Retry;
- Owner error state preserves download link;
- Original URL is never assigned to `<img src>`;
- Lightbox keeps Thumbnail visible until Preview loads.

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test -- src/lib/image-assets.test.ts src/components/DerivativeImage.test.tsx src/components/ImageLightbox.test.tsx
```

- [ ] **Step 3: Implement**

`DerivativeImage` accepts derivative `src`, alt, optional Original URL/filename, loading/fetch priority, labels, and renders a Retry state using `?retry=<timestamp>`.

`ImageLightbox` accepts an `ImageAsset`, navigation callbacks, and labels. It preloads Preview with `new Image()` while showing Thumbnail. Escape closes. Original download renders only for non-null `originalUrl`.

Add English/Chinese:
- `image.unavailable`
- `image.retry`
- `image.close`
- `image.previous`
- `image.next`

- [ ] **Step 4: Verify GREEN**

```powershell
npm.cmd run typecheck
npm.cmd run test -- src/lib/image-assets.test.ts src/components/DerivativeImage.test.tsx src/components/ImageLightbox.test.tsx src/i18n/translations.test.ts
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add src/lib/image-assets.ts src/lib/image-assets.test.ts src/components/DerivativeImage.tsx src/components/DerivativeImage.test.tsx src/components/ImageLightbox.tsx src/components/ImageLightbox.test.tsx src/i18n/translations.ts src/i18n/translations.test.ts src/styles/feature-upgrades.css
git commit -m "feat: add optimized image components"
```

---

### Task 8: Migrate Memory cards and detail Gallery

**Files:**
- Modify: `src/components/MemoryCard.tsx`
- Create: `src/components/MemoryCard.test.tsx`
- Modify: `src/pages/MemoryDetailPage.tsx`
- Create: `src/pages/MemoryDetailPage.image-delivery.test.tsx`
- Modify: `src/lib/memory-assets.ts`
- Modify: `src/lib/memory-assets.test.ts`

- [ ] **Step 1: Write RED tests**

Assert:
- image card uses `thumbnailUrl`, not legacy `url`;
- video card still uses `url`;
- Guest image has no download action;
- Owner image uses `originalUrl`;
- video uses legacy `downloadUrl`;
- detail grid uses Thumbnail;
- selected image opens Lightbox using Preview;
- Owner image Original is available only when non-null;
- visibility/deletion helpers preserve union-specific fields.

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test -- src/components/MemoryCard.test.tsx src/pages/MemoryDetailPage.image-delivery.test.tsx src/lib/memory-assets.test.ts
```

- [ ] **Step 3: Implement**

In `MemoryCard`, branch on `type`:
- video unchanged;
- image uses `DerivativeImage` + Thumbnail;
- image download only when `originalUrl` exists.

In `MemoryDetailPage`:
- video rendering/actions unchanged;
- image grid uses Thumbnail;
- selected image ID opens `ImageLightbox`;
- previous/next operate among images only;
- image footer uses `originalUrl`;
- Guest image download is absent.

Do not change Add Photos, visibility, or deletion behavior.

- [ ] **Step 4: Verify GREEN**

```powershell
npm.cmd run typecheck
npm.cmd run test -- src/components/MemoryCard.test.tsx src/pages/MemoryDetailPage.image-delivery.test.tsx src/lib/memory-assets.test.ts src/lib/memory-visibility.test.ts
npm.cmd run check
npm.cmd run build
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add src/components/MemoryCard.tsx src/components/MemoryCard.test.tsx src/pages/MemoryDetailPage.tsx src/pages/MemoryDetailPage.image-delivery.test.tsx src/lib/memory-assets.ts src/lib/memory-assets.test.ts
git commit -m "feat: use optimized images in memories"
```

---

### Task 9: Persisted Session Thumbnail UI

**Files:**
- Modify: `src/pages/UploadSessionReviewPage.tsx`
- Modify: `src/pages/UploadSessionReviewPage.test.tsx`
- Modify: `src/components/upload/UploadSessionReviewCard.tsx`
- Modify: `src/components/upload/UploadSessionReviewGrid.tsx`
- Modify: `src/components/upload/UploadSessionReviewGrid.test.tsx`

- [ ] **Step 1: Write RED tests**

Add:

```ts
reviewPreviewUrl(
  sessionId,
  fileId,
  serverStatus,
  localUrl,
): string | null
```

Assertions:
- local Blob always wins;
- uploaded without local Blob uses Session Thumbnail;
- pending/failed/skipped without local Blob returns null;
- Session Thumbnail error shows Retry;
- retry changes query only.

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test -- src/pages/UploadSessionReviewPage.test.tsx src/components/upload/UploadSessionReviewGrid.test.tsx
```

- [ ] **Step 3: Implement**

Build preview map for every Session file:
1. local Blob URL;
2. otherwise owned Session Thumbnail for `uploaded`;
3. otherwise no image.

Do not require reselection for an already uploaded file merely because its local Blob disappeared. Keep existing reselection requirement for files that still need upload bytes.

- [ ] **Step 4: Verify GREEN**

```powershell
npm.cmd run typecheck
npm.cmd run test -- src/pages/UploadSessionReviewPage.test.tsx src/components/upload/UploadSessionReviewGrid.test.tsx src/contexts/PhotoSessionUploadContext.test.tsx src/lib/photo-upload-workflow-regression.test.ts
npm.cmd run check
npm.cmd run build
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add src/pages/UploadSessionReviewPage.tsx src/pages/UploadSessionReviewPage.test.tsx src/components/upload/UploadSessionReviewCard.tsx src/components/upload/UploadSessionReviewGrid.tsx src/components/upload/UploadSessionReviewGrid.test.tsx
git commit -m "feat: restore upload session thumbnails"
```

---

### Task 10: Release 1 hardening and stop gate

**Files:**
- Create: `docs/superpowers/plans/2026-07-21-phase3a-release1-manual-verification.md`
- Create: `docs/superpowers/plans/2026-07-21-phase3a-dependency-audit.md`
- Modify tests only when a coverage gap is found.

- [ ] **Step 1: Audit dependencies without changing them**

```powershell
npm.cmd audit --omit=dev
npm.cmd audit
npm.cmd outdated
```

Record each high finding, direct/transitive, runtime/dev, fixed version, and breaking-change risk. Do not run `npm audit fix --force`.

- [ ] **Step 2: Write Release 1 checklist**

Include:
- Owner Public/Private Thumbnail and Preview;
- Owner Original download;
- Guest Published + Public;
- Guest Private/Draft 404;
- Guest no image Original action;
- legacy image routes still work;
- normal iPhone image below 20 MB;
- image above 20 MB exercises remote mode;
- small image proves no upscaling;
- GIF produces static derivative;
- Session refresh Thumbnail;
- Create/Append;
- Asset/Memory delete;
- video playback/download regression;
- Network proof normal browsing never requests `/original`.

- [ ] **Step 3: Run fresh Release 1 verification**

```powershell
npm.cmd run typecheck
npm.cmd run check
npm.cmd run build
npm.cmd exec wrangler -- deploy --dry-run
git diff --check
git status --short
git log --oneline -12
```

- [ ] **Step 4: Commit verification docs**

```powershell
git add docs/superpowers/plans/2026-07-21-phase3a-release1-manual-verification.md docs/superpowers/plans/2026-07-21-phase3a-dependency-audit.md
git commit -m "test: harden phase 3a dual delivery"
```

- [ ] **Step 5: STOP**

Report tests, build, dry-run, audit, scope, branch/HEAD, and confirm nothing was pushed or deployed.

Do not continue until the user:
1. approves Release 1 push/deploy;
2. creates `IMAGE_SOURCE_SIGNING_KEY` using `wrangler secret put`;
3. completes production Owner/Guest smoke testing.

---

### Task 11: Release 1 deployment gate

**Files:**
- Update Release 1 checklist with actual evidence.
- Code changes only after a reproducing RED test.

- [ ] **Step 1: Create production secret after approval**

```powershell
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$secret = [Convert]::ToBase64String($bytes)
$rng.Dispose()
$secret | npm.cmd exec wrangler -- secret put IMAGE_SOURCE_SIGNING_KEY
Remove-Variable secret
```

Never print or commit it.

- [ ] **Step 2: Merge/push safely**

Verify clean branch, merge to local `main` with `--no-commit`, rerun full check/build, create merge commit, push `main`, and verify `origin/main` SHA.

- [ ] **Step 3: Verify both domains**

Check `lucyandalan.com` and the Workers domain for health, bundle hashes, new derivative routes, compatibility routes, and SPA routes.

- [ ] **Step 4: Complete smoke testing**

Record Owner, Guest, Session, large-source, delete, visibility, and video results.

- [ ] **Step 5: Require explicit Release 2 approval**

Release 1 approval does not authorize secure cutover.

---

### Task 12: Release 2 secure cutover

**Files:**
- Modify: `shared/contracts.ts`
- Modify: `worker/lib/memories.ts`
- Modify: `worker/index.ts`
- Modify: `worker/lib/image-routes.ts`
- Modify: image route/delivery tests
- Modify: frontend image tests/code that still mentions legacy image fields
- Create: `docs/superpowers/plans/2026-07-21-phase3a-release2-manual-verification.md`

- [ ] **Step 1: Write RED tests**

Assert:
- image JSON has Thumbnail/Preview/Original only;
- Guest image Original is null;
- video still has `url` and `downloadUrl`;
- Guest image `/download` returns 404;
- Owner image `/download` returns Original attachment;
- generic image `/api/assets/:id` returns WebP Preview;
- generic video route retains Range support;
- frontend has no image legacy-field usage.

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test -- worker/lib/image-routes.test.ts worker/lib/image-delivery.test.ts src/components/MemoryCard.test.tsx src/pages/MemoryDetailPage.image-delivery.test.tsx
```

- [ ] **Step 3: Implement cutover**

Remove image `url`/`downloadUrl` from contract and JSON. Route generic image display to Preview and generic image download to Owner-only Original. Keep generic video routes delegated to legacy `serveAsset()`.

- [ ] **Step 4: Verify GREEN**

```powershell
npm.cmd run typecheck
npm.cmd run check
npm.cmd run build
npm.cmd exec wrangler -- deploy --dry-run
git diff --check
```

Write Release 2 checks for Guest Original denial, Owner Original success, generic Preview alias, immediate Public/Private transitions, derivative-only normal browsing, and video regression.

- [ ] **Step 5: Commit and STOP**

```powershell
git add shared/contracts.ts worker/lib/memories.ts worker/index.ts worker/lib/image-routes.ts worker/lib/image-routes.test.ts worker/lib/image-delivery.test.ts src/components/MemoryCard.tsx src/pages/MemoryDetailPage.tsx src/components/MemoryCard.test.tsx src/pages/MemoryDetailPage.image-delivery.test.tsx docs/superpowers/plans/2026-07-21-phase3a-release2-manual-verification.md
git commit -m "feat: secure legacy image routes"
```

Wait for explicit Release 2 deployment approval.

---

### Task 13: Release 2 verification and branch finish

- [ ] **Step 1: Deploy through the same verified merge/push process after approval.**
- [ ] **Step 2: Run both-domain Release 2 smoke tests.**
- [ ] **Step 3: Run fresh `npm run check`, `npm run build`, `git diff --check`, and clean-status verification.**
- [ ] **Step 4: Report production SHA, test count, Owner/Guest results, visibility transitions, Session Thumbnail, large-source mode, and video regression.**
- [ ] **Step 5: Invoke the finishing-a-development-branch workflow and present the standard branch/worktree choices.**
