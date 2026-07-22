# Phase 3A Release 2 Manual Verification

## Scope

Branch: `feature/phase3a-secure-image-delivery`

Release 2 removes legacy image URLs from the API contract and switches the generic image aliases to the secure derivative/original routes. Video delivery remains on the existing legacy route. Production verification below was run against the deployed Release 2 Worker.

## Automated evidence

- `npm.cmd run typecheck`: passed.
- `npm.cmd run check`: passed, 46 test files / 212 tests.
- `npm.cmd run build`: passed.
- `npm.cmd exec wrangler -- deploy --dry-run`: passed; Wrangler read 17 client assets, reported 148.04 KiB total upload / 32.79 KiB gzip, listed DB/MEDIA/IMAGES/ASSETS bindings, and exited without deploying.
- `git diff --check`: passed.

## Task 13 production evidence

- Deployed Worker version: `6d476fbe-ead2-423f-8585-a9b5380fe865`.
- Domains checked: `https://our-love-story.xingalan1992.workers.dev` and `https://lucyandalan.com`.
- Both domains returned `200` for `/api/health` and `/api/memories`.
- Guest API returned 20 memories / 61 visible image assets on each domain; no legacy `url` or `downloadUrl` fields were present on image assets.
- Production D1 contains 108 images and 0 videos. It contains 2 completed append sessions, both JPEGs under 20 MB; there is no production video, large-source, or active upload-session fixture for this smoke run.
- Owner-authenticated browser smoke showed private memory cards and owner-only original links. A programmatic download response was not captured because the browser blocked the automation attempt before navigation; no browser security bypass was used.

## Owner and Guest matrix

- [x] Guest: public image Thumbnail and Preview load through derivative routes on both production domains (`200 image/webp`).
- [x] Guest: private image generic display and all direct variants return 404. No draft asset exists in the production fixture.
- [x] Guest: image `/api/assets/:id/download` returns 404, including for the checked public image.
- [x] Owner: authenticated browser smoke renders private memory cards and exposes owner-only image entries.
- [ ] Owner: image `/api/assets/:id/download` returns the Original as an attachment.
- [ ] Owner: explicit `/original` still returns the Original as an attachment.
- [ ] Public/Private visibility changes take effect immediately for derivative and Original routes.

## Contract and browsing checks

- [x] Image JSON exposes `thumbnailUrl`, `previewUrl`, and owner-gated `originalUrl` for delivery URLs; legacy image fields are absent.
- [x] Video JSON and delivery regression are covered by the local route suite; production video verification is N/A because D1 has 0 videos.
- [x] Normal Guest image browsing requests Thumbnail only and never requests `/original`.
- [x] The generic public image alias `/api/assets/:id` returns WebP Preview content on both production domains.
- [x] Frontend image code has no legacy image `url` or `downloadUrl` usage.

## Video regression

- [x] Generic video playback, Range (`206` / `Content-Range`), and download behavior pass the local image-delivery regression suite; production verification is N/A because no video fixture exists.

## Gate status

Release 2 is deployed and the Guest/API smoke checks pass. Before claiming full production acceptance or merging to `main`, review the remaining manual gaps: authenticated Original/download response, a controlled visibility transition, and (if required) production video/large-source/session-thumbnail fixtures. No further deployment was performed during Task 13.
