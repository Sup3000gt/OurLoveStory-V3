# Phase 3A Release 2 Manual Verification

## Scope

Branch: `feature/phase3a-secure-image-delivery`

Release 2 removes legacy image URLs from the API contract and switches the generic image aliases to the secure derivative/original routes. Video delivery remains on the existing legacy route. This checklist is prepared before deployment; no production acceptance is claimed here.

## Automated evidence

- `npm.cmd run typecheck`: passed.
- `npm.cmd run check`: passed, 46 test files / 212 tests.
- `npm.cmd run build`: passed.
- `npm.cmd exec wrangler -- deploy --dry-run`: passed; Wrangler read 17 client assets, reported 148.04 KiB total upload / 32.79 KiB gzip, listed DB/MEDIA/IMAGES/ASSETS bindings, and exited without deploying.
- `git diff --check`: passed.

## Owner and Guest matrix

- [ ] Guest: public image Thumbnail and Preview load through derivative routes.
- [ ] Guest: private or draft image generic display returns 404.
- [ ] Guest: image `/api/assets/:id/download` returns 404, including for public images.
- [ ] Owner: private or draft image generic display loads the Preview derivative.
- [ ] Owner: image `/api/assets/:id/download` returns the Original as an attachment.
- [ ] Owner: explicit `/original` still returns the Original as an attachment.
- [ ] Public/Private visibility changes take effect immediately for derivative and Original routes.

## Contract and browsing checks

- [ ] Image JSON exposes only `thumbnailUrl`, `previewUrl`, and owner-gated `originalUrl` for delivery URLs.
- [ ] Video JSON retains `url` and `downloadUrl`.
- [ ] Normal image browsing requests Thumbnail/Preview only and never requests `/original`.
- [ ] The generic image alias `/api/assets/:id` returns WebP Preview content.
- [ ] Frontend image code has no legacy image `url` or `downloadUrl` usage.

## Video regression

- [ ] Generic video playback remains available at `/api/assets/:id`.
- [ ] Generic video Range requests still return `206` with a correct `Content-Range`.
- [ ] Generic video downloads remain available at `/api/assets/:id/download`.

## Gate status

Task 11 remaining manual smoke gaps are intentionally skipped for this iteration. Do not merge to `main`, deploy, or claim Release 2 production acceptance until the checklist is completed and explicit deployment approval is provided.
