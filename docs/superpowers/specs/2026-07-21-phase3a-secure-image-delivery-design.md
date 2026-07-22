# Phase 3A Secure Image Delivery Design

**Date:** 2026-07-21  
**Branch:** `feature/phase3a-secure-image-delivery`  
**Base commit:** `159ad3666594933df3781c3c0a0a2d3c9fcbd319`  
**Status:** Approved design pending written-spec review

## 1. Goal

Phase 3A replaces direct image-original delivery with a secure derivative pipeline while preserving the existing video behavior.

The completed system must:

1. Keep every image original private in R2.
2. Let Owners browse Public and Private optimized images.
3. Let Guests browse only Published + Public optimized images.
4. Let only Owners download image originals.
5. Display real Upload Session thumbnails after a browser refresh.
6. Migrate existing and future images into one delivery model without a one-time bulk conversion.
7. Preserve the current legacy video delivery path.
8. Roll out in two safe production releases.

## 2. Approved Product Decisions

### 2.1 Access policy

Owner:

- May view Public and Private thumbnails.
- May view Public and Private previews.
- May download Public and Private image originals.
- May view an owned Upload Session thumbnail.

Guest:

- May view only Published + Public thumbnails and previews.
- May not access any image original.
- May not access Private, Draft, or Upload Session image resources.
- Receives `404 Not Found`, not `403`, for unauthorized resources.

Video remains outside Phase 3A:

- Existing video playback and download behavior remains unchanged.
- A later Video Delivery phase may redesign video security, posters, and streaming.

### 2.2 Browsing policy

Both Owner and Guest pages use optimized derivatives for normal browsing.

- Cards and gallery grids use `thumbnailUrl`.
- Lightbox uses `previewUrl`.
- Original bytes are read only after an Owner explicitly selects Download Original.
- An image derivative failure never falls back to loading the original into the page.

### 2.3 Migration policy

All existing and future images use the Phase 3A delivery model.

Migration is lazy rather than a deployment-time bulk conversion:

- Existing images generate a derivative the first time that variant is requested.
- New Upload Session photos normally have a Session thumbnail before confirmation.
- Confirm promotes the Session thumbnail and schedules final Preview generation.
- Missing final derivatives remain recoverable through lazy generation.

No derivative readiness state is stored in D1. R2 object existence is the source of truth.

## 3. Current System Context

The current system stores original media in the `our-love-story-media` R2 bucket.

The current image contract exposes:

- `url`
- `downloadUrl`

Both routes read the same R2 original object. Public assets in Published Memories are available to Guests; other assets require Owner authentication.

Phase 3A separates optimized display resources from original downloads.

Existing Clerk authentication accepts either:

- `Authorization: Bearer <token>`
- Same-origin Clerk `__session` cookie

Private images can therefore remain ordinary same-origin `<img src="/api/...">` elements without adding tokens to URLs.

## 4. Scope

### 4.1 Included

- Cloudflare Images binding.
- Secure image Thumbnail, Preview, and Original routes.
- Hybrid transformation support for source files up to Cloudflare remote-image limits.
- Persistent derivatives in R2.
- Upload Session thumbnails.
- Session-thumbnail promotion during confirmation.
- Derivative cleanup during Session, Asset, and Memory deletion.
- Image and video discriminated-union contracts.
- Frontend thumbnail, lightbox, placeholder, and Owner-download behavior.
- Release 1 dual delivery.
- Release 2 secure cutover.
- Unit, Worker-route, R2 integration, Upload Session, frontend, build, and production smoke verification.
- Structured transformation logs.

### 4.2 Excluded

- Video transcoding, posters, adaptive streaming, or video permission redesign.
- Accepting new HEIC/HEIF files in upload selectors and validators; that is Phase 3B.
- A one-time batch conversion of every historical image.
- D1 derivative status columns.
- A derivative-jobs table.
- Durable Objects or D1 distributed locks.
- Long-lived signed browser URLs.
- Automatic upgrade to Cloudflare Images Paid.
- Phase 4 orphan cleanup cron and operational dashboards.

## 5. Asset Contract

Replace the single `MemoryAsset` interface with a discriminated union.

```ts
export type MemoryAsset =
  | ImageAsset
  | VideoAsset;

export interface ImageAsset {
  type: 'image';
  id: string;
  thumbnailUrl: string;
  previewUrl: string;
  originalUrl: string | null;
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
```

Owner image responses set:

```text
originalUrl = /api/assets/:assetId/original
```

Guest image responses set:

```text
originalUrl = null
```

### 5.1 Release 1 compatibility fields

Release 1 returns an image superset temporarily:

```ts
export interface DualDeliveryImageAsset extends ImageAsset {
  url: string;
  downloadUrl: string;
}
```

The new frontend ignores the legacy fields. They exist only as a rollback path.

Release 2 removes image `url` and `downloadUrl`. Video fields remain unchanged.

## 6. Public API Routes

### 6.1 Final image routes

```text
GET|HEAD /api/assets/:assetId/thumbnail
GET|HEAD /api/assets/:assetId/preview
GET|HEAD /api/assets/:assetId/original
```

### 6.2 Upload Session route

```text
GET|HEAD /api/upload-sessions/:sessionId/files/:sessionFileId/thumbnail
```

The Session route requires the signed-in authorized Owner, confirms Session ownership, confirms that the file belongs to the Session, and requires an uploaded original object.

### 6.3 Compatibility routes

Release 1 preserves current behavior:

```text
/api/assets/:assetId
/api/assets/:assetId/download
```

Release 2 changes:

```text
/api/assets/:assetId
→ Preview compatibility alias

/api/assets/:assetId/download
→ Owner-only Original compatibility alias
```

All unauthorized image resource requests return `404 Not Found`.

## 7. R2 Object Layout

Original keys remain unchanged:

```text
originals/<ownerId>/<sessionId>/<sessionFileId>.<extension>
```

Final derivatives:

```text
derivatives/v1/assets/<assetId>/thumbnail.webp
derivatives/v1/assets/<assetId>/preview.webp
```

Upload Session derivative:

```text
derivatives/v1/upload-sessions/<sessionId>/<sessionFileId>/thumbnail.webp
```

The `v1` namespace isolates the approved dimensions, quality, output format, and metadata policy. Future changes use a new version instead of overwriting keys with different semantics.

## 8. Derivative Variants

### 8.1 Thumbnail

```text
Maximum edge: 640 px
Output: WebP
Quality: 75
Fit: scale-down
Animation: disabled
Metadata: removed by WebP output
```

### 8.2 Preview

```text
Maximum edge: 2048 px
Output: WebP
Quality: 82
Fit: scale-down
Animation: disabled
Metadata: removed by WebP output
```

`scale-down` preserves aspect ratio and never enlarges a smaller source.

Animated GIF input produces a static first-frame WebP derivative. The original GIF remains unchanged in R2 and is downloadable only by an Owner.

EXIF rotation and color profile are applied during transformation. WebP output does not retain EXIF metadata such as GPS.

## 9. Hybrid Transformation Engine

### 9.1 Reason for a hybrid design

Cloudflare Images binding accepts raw input bytes up to 20 MB. Remote Images transformations support image files up to 100 MB and 100 MP, with format-specific dimension limits.

Some high-quality iPhone and DJI images can exceed 20 MB. Phase 3A must not make those images permanently undisplayable.

### 9.2 Path selection

The Worker reads R2 object metadata before transformation.

```text
Source size <= 20 MB
→ R2 object body
→ env.IMAGES.input(stream)
→ transform
→ output WebP

Source size > 20 MB and <= 100 MB
→ create a 60-second internal signed source URL
→ fetch(url, { cf: { image: variantOptions } })
→ receive transformed WebP

Source size > 100 MB or source area > 100 MP
→ transformation unavailable
→ 503 + Retry-After
→ Owner may still explicitly download Original
```

Image-area failures that are discovered only by the transformation service follow the same 503 behavior.

### 9.3 Internal signed source route

Large-source transformation uses a Worker-internal route such as:

```text
GET /api/internal/image-source/assets/:assetId
GET /api/internal/image-source/upload-sessions/:sessionId/files/:sessionFileId
```

Required query fields:

```text
expires=<unix timestamp>
signature=<HMAC-SHA256>
```

Rules:

- Signature payload includes resource type, IDs, and expiry.
- Expiry is at most 60 seconds in the future.
- Secret is stored as `IMAGE_SOURCE_SIGNING_KEY`.
- The signed URL is never returned to the browser or included in application JSON.
- Logs must not record the query string.
- The source route does not perform a transformation, preventing recursion.
- Invalid, expired, missing, or mismatched signatures return `404`.
- Source responses use `Cache-Control: private, no-store`.
- The source route streams only the exact R2 original selected by the signed resource identity.

This route exists only to let Cloudflare's anonymous remote transformation fetch a private original. It is not a user-facing original route.

### 9.4 Cloudflare bindings

`wrangler.toml` adds:

```toml
[images]
binding = "IMAGES"
```

`Env` adds the Images binding and signing secret.

No Cloudflare Images hosted storage is used. Original and derivative objects stay in the existing R2 bucket.

## 10. Persistent Generation Flow

A Thumbnail or Preview request performs:

1. Parse route and variant.
2. Query the D1 Asset descriptor.
3. Determine Owner/Guest access.
4. Return `404` before R2 reads when access is denied.
5. Compute the deterministic derivative key.
6. Read the derivative from R2.
7. If present, return it.
8. If absent, join or create the in-isolate generation Promise.
9. Read the original metadata and choose binding or remote transformation.
10. Transform to the fixed WebP variant.
11. Persist bytes and HTTP metadata at the deterministic R2 key.
12. Return the persisted response.
13. Remove the in-flight Promise in `finally`.

R2 existence is the only derivative-readiness state.

## 11. Concurrency

Use a module-level map:

```ts
const derivativeGenerations =
  new Map<string, Promise<GeneratedDerivative>>();
```

Within one Worker isolate, requests for the same derivative key share one Promise.

Across isolates, rare duplicate transformation is accepted:

- Every writer uses the same deterministic key.
- Output parameters are identical.
- The final R2 state is equivalent.
- No Durable Object, KV lock, D1 lease, or derivative status is introduced.

## 12. HTTP and Cache Behavior

### 12.1 Public Thumbnail and Preview

```http
Content-Type: image/webp
Cache-Control: public, no-cache, must-revalidate
ETag: <R2 derivative ETag>
X-Content-Type-Options: nosniff
```

Every reuse must revalidate through the Worker, so Public → Private visibility changes take effect immediately. A matching ETag returns `304 Not Modified`.

### 12.2 Private Thumbnail and Preview

```http
Content-Type: image/webp
Cache-Control: private, no-store
ETag: <R2 derivative ETag>
X-Content-Type-Options: nosniff
```

Private responses are not placed in shared caches.

### 12.3 Image Original

```http
Cache-Control: private, no-store
Content-Disposition: attachment
X-Content-Type-Options: nosniff
Accept-Ranges: bytes
```

Original supports `GET`, `HEAD`, `Range`, and `206 Partial Content`.

Only an authorized Owner may read it.

### 12.4 Error response

Generation, transformation, or persistence failure returns:

```http
HTTP/1.1 503 Service Unavailable
Retry-After: 5
Cache-Control: no-store
```

The response never redirects to or streams the Original.

Quota error `9422`, timeout, unsupported source, source-too-large, R2 read failure, Images error, and R2 write failure receive distinct internal error codes.

## 13. Structured Logging

Every generation attempt records:

```text
event = image_derivative
requestId
assetId or sessionId + sessionFileId
variant
derivativeKey
sourceSizeBytes
transformMode = binding | remote
cacheResult = r2_hit | generated
durationMs
errorCode when applicable
```

Never log Clerk tokens, signing secrets, signed query strings, raw HMAC signatures, or image bytes.

Cloudflare Images Free allows 5,000 unique transformations per calendar month. Exceeding the Free quota causes new transformations to fail while existing cached transformations continue. Phase 3A maps this condition to the normal safe placeholder flow and does not automatically enable paid billing.

## 14. Upload Session Thumbnail

### 14.1 Read behavior

Without browser refresh, Review prefers the existing local Blob preview.

After refresh:

```text
uploaded file → Session Thumbnail route
pending or failed file → reselection UI
skipped file → skipped state
```

A missing Session Thumbnail is generated lazily from the uploaded original and persisted in the Session derivative key.

### 14.2 Confirm promotion

After the D1 confirmation transaction succeeds:

1. Map each accepted `sessionFileId` to its new `assetId`.
2. If the Session Thumbnail exists, read it.
3. Put it at the final Asset Thumbnail key.
4. Delete the Session Thumbnail.
5. Schedule final Preview generation with `ctx.waitUntil()`.
6. If no Session Thumbnail exists, schedule both final variants or let lazy generation fill the gap.

Promotion and Preview generation are post-transaction side effects. They cannot roll back an already confirmed Memory.

Failure is logged and recovered by later lazy generation.

### 14.3 Abandon

Abandon deletes Session original objects, Session thumbnail objects, and Session records according to the existing lifecycle.

If R2 cleanup fails after the Session is marked abandoned, return the existing cleanup-related 503 behavior and log the derivative keys as cleanup targets.

## 15. Asset and Memory Deletion

Deleting an image Asset attempts to delete:

```text
Original object
derivatives/v1/assets/<assetId>/thumbnail.webp
derivatives/v1/assets/<assetId>/preview.webp
```

Deleting a Memory attempts the same for every image Asset.

Video cleanup remains unchanged.

Missing derivative objects are harmless.

A derivative deletion failure does not restore a completed D1 deletion. It is logged as an orphan for the future Phase 4 cleanup job.

## 16. Frontend Behavior

### 16.1 Cards and gallery

Image cards use `thumbnailUrl`. The primary above-the-fold cover may use `loading="eager"` and `fetchPriority="high"`. Other images use lazy loading and async decoding.

Video components continue to use `url`.

### 16.2 Lightbox

When an image opens:

1. Keep the already loaded Thumbnail visible.
2. Begin loading `previewUrl`.
3. Replace the Thumbnail when Preview succeeds.
4. Preserve navigation controls while loading.

Owner lightbox shows Download Original only when the image `originalUrl` is non-null.

Guest lightbox does not display an image download action.

Video lightbox behavior remains unchanged.

### 16.3 Failure placeholder

An image `onError` switches to a safe placeholder:

```text
Image temporarily unavailable
Retry
```

Owner additionally retains Download Original.

Retry appends `?retry=<timestamp>`. The query does not alter the derivative key or transformation parameters.

Original is never assigned to an image `src` as a fallback.

## 17. Release 1 — Dual Delivery

### 17.1 Backend

Add the Images binding, signing secret support, hybrid transformer, R2 key builder, new image routes, internal signed source routes, Session Thumbnail route, Confirm promotion, cleanup, and structured logs.

Keep current routes unchanged:

```text
/api/assets/:assetId
/api/assets/:assetId/download
```

Return new and old image fields.

### 17.2 Frontend

Switch image presentation to Thumbnail, Preview, Owner-only Original download, and Session Thumbnail after refresh.

Ignore legacy image `url` and `downloadUrl`.

### 17.3 Rollback

If the new derivative pipeline fails in production:

- Revert frontend image reads to legacy fields.
- No D1 rollback is required.
- R2 originals remain unchanged.
- Generated derivative objects are harmless and versioned.

### 17.4 Production checks

Verify Owner Public/Private derivatives, Original download, Session refresh, Create, Append, Asset deletion, and Memory deletion.

Verify Guest Published + Public derivatives, Private and Draft 404, no Original UI, and working compatibility routes.

Verify video playback and download regression.

## 18. Release 2 — Secure Cutover

After Release 1 smoke testing:

```text
/api/assets/:assetId → Preview compatibility alias
/api/assets/:assetId/download → Owner-only Original compatibility alias
```

Remove legacy image fields from the API contract and frontend.

Guest requests to both Original routes return 404 for image Assets.

Verify Owner Original download, Preview compatibility bytes, immediate Public/Private transitions, normal browsing without Original reads, and unchanged video behavior.

## 19. Testing Strategy

### 19.1 Unit tests

- Derivative keys and variants.
- Width 640 and 2048.
- Quality 75 and 82.
- WebP, scale-down, static animation.
- Access and cache policy.
- Signature and expiry validation.
- 20 MB mode boundary.
- 100 MB rejection boundary.
- Promise deduplication.

### 19.2 Worker route tests

- Owner Public and Private derivatives.
- Guest Published + Public.
- Guest Private, Draft, and Original return 404.
- Missing resources return 404.
- Binding and remote failures return 503 + Retry-After.
- Invalid and expired internal signatures return 404.
- HEAD and ETag 304.

### 19.3 R2 integration tests

- R2 hit bypasses transformation.
- <=20 MB uses Images binding.
- >20 MB uses remote transformation.
- Persistence keys are correct.
- Concurrent requests share one local Promise.
- Asset and Memory deletion remove derivatives.
- Missing derivatives are harmless.

### 19.4 Upload Session tests

- Owned uploaded Session Thumbnail.
- Other Owner and Guest 404.
- Pending file cannot generate.
- Confirm promotes Thumbnail and schedules Preview.
- Confirm survives derivative failure.
- Abandon removes Original and Session Thumbnail.

### 19.5 Frontend tests

- Image cards use Thumbnail.
- Lightbox uses Preview and progressive replacement.
- Owner download and Guest omission.
- Failure placeholder and Retry.
- Video uses legacy URL.
- Local Blob wins before refresh.
- Session Thumbnail appears after refresh.

### 19.6 Production-only verification

Test a normal iPhone JPEG below 20 MB, a source above 20 MB, a small source, an animated GIF, Public/Private/Draft access, Session refresh, visibility changes, Owner Original download, Guest denial, and video regression.

## 20. Cost and Limits

R2 stores originals and persistent derivatives. Cloudflare Images hosted storage is not used.

Images Free currently includes 5,000 unique transformations per calendar month. No paid plan is automatically enabled.

Relevant limits:

```text
Images binding raw input: 20 MB
Remote transformation file size: 100 MB
Remote transformation image area: 100 MP
```

Sources beyond supported limits remain Owner-downloadable but display a safe placeholder.

## 21. Security Invariants

1. Guest API responses never contain an image Original URL.
2. No Guest route returns image Original bytes.
3. Unauthorized image and Session resources return 404.
4. R2 object keys are never exposed as browser URLs.
5. Internal source signatures are short-lived and never returned to clients.
6. Signed source query strings are never logged.
7. Private and Draft image responses are never shared-cacheable.
8. Public derivative reuse still revalidates access through the Worker.
9. A derivative failure never falls back to Original.
10. Image deletion includes deterministic derivative keys.
11. Video behavior is not silently changed.
12. Original objects remain unchanged throughout derivative generation.

## 22. Completion Criteria

Phase 3A is complete only after both releases satisfy:

- Every image card and gallery uses Thumbnail.
- Every image lightbox uses Preview.
- Owner normal browsing never reads Original.
- Guest API image objects have `originalUrl: null`.
- Guest cannot access image Original bytes through new or compatibility routes.
- Private and Draft derivatives return 404 to Guests.
- Upload Session refresh displays a real Thumbnail for uploaded files.
- Historical images generate lazily.
- New confirmed photos promote or generate derivatives.
- Sources over 20 MB use the remote path.
- Failures show placeholders and never Originals.
- Deletion cleans deterministic derivative keys.
- Release 1 and Release 2 smoke tests pass.
- Video behavior has no regression.
- Full tests and production build pass.

## 23. Reference Material

Official Cloudflare documentation, reviewed 2026-07-21:

- Images binding: https://developers.cloudflare.com/images/optimization/binding/
- Limits and formats: https://developers.cloudflare.com/images/get-started/limits/
- Optimization features: https://developers.cloudflare.com/images/optimization/features/
- Transform via Workers: https://developers.cloudflare.com/images/optimization/transformations/transform-via-workers/
- Images pricing: https://developers.cloudflare.com/images/pricing/
