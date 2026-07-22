# Phase 3A Release 1 Manual Verification

## Scope

Branch: `feature/phase3a-secure-image-delivery`

Release 1 covers the secure image delivery implementation through Task 10. Production deployment was approved and completed on 2026-07-22.

## Automated evidence

- `npm.cmd run check`: passed, 46 test files / 204 tests.
- `npm.cmd run build`: passed.
- `npm.cmd exec wrangler -- deploy --dry-run`: passed; Wrangler read 17 client assets, reported 147.71 KiB total upload / 32.65 KiB gzip, listed DB/MEDIA/IMAGES/ASSETS bindings, and exited without deploying.
- `git diff --check`: passed.
- Production-only audit: 0 vulnerabilities.
- Full audit: four high findings in the dev-only Miniflare/sharp dependency chain; see the dependency audit document.

## Production deployment evidence

- GitHub `main`: `2eb9021900b42324f77e6190fbf9af07c70044bb`.
- Worker version: `3f3d848a-42e8-4c97-a7b6-9bdd524cc748`, deployed at 100% traffic.
- `https://lucyandalan.com/api/health`: 200.
- `https://our-love-story.xingalan1992.workers.dev/api/health`: 200.
- Both domains returned public Memories successfully.
- Public image fixture `6bcc498c-8f40-4383-80b8-bbfe07d23cff`: Thumbnail and Preview returned 200 `image/webp`, with public revalidation headers; Guest Original returned 404.
- The same fixture's legacy generic and `/download` routes returned 200, preserving Release 1 compatibility.
- Invalid and expired internal image-source signatures returned 404.
- SPA memory route returned 200 on the custom domain.

## Owner and Guest matrix

- [ ] Owner: public image Thumbnail and Preview load.
- [ ] Owner: private image Thumbnail and Preview load.
- [ ] Owner: Original download uses the Original route only after an explicit download action.
- [x] Guest: published Memory with public image loads Thumbnail and Preview.
- [ ] Guest: private or draft Memory returns 404 for image delivery (requires an authenticated Owner fixture to identify a private/draft asset).
- [x] Guest: no image Original download action is rendered by the public contract (`originalUrl = null`).
- [x] Legacy image routes still work.

## Image processing and storage

- [ ] Normal iPhone image below 20 MB uses the Images binding path.
- [ ] Image above 20 MB exercises remote transform mode.
- [ ] Small image is not upscaled.
- [ ] GIF produces a static WebP derivative.
- [ ] Session refresh displays the persisted Session Thumbnail.
- [ ] Create Session promotes thumbnails and schedules Preview generation.
- [ ] Append Session promotes thumbnails and schedules Preview generation.
- [ ] Abandon removes Session Originals and Session Thumbnails.
- [ ] Asset deletion removes image Original, Thumbnail, and Preview while preserving video cleanup behavior.
- [ ] Memory deletion removes all image derivatives.

## Regression and privacy checks

- [ ] Video playback and legacy download remain unchanged.
- [ ] Network capture confirms normal browsing never requests `/original`.
- [ ] Retry changes only the image URL query and does not expose the Original URL.

## Gate status

Owner-authenticated private-image, Session, large-source, deletion, visibility-transition, and video regression smoke tests remain pending because this environment has no authenticated Clerk browser session. Release 2 secure cutover remains unapproved and must not proceed until those Owner checks are completed and explicitly approved.
