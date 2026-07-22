# Phase 3A Release 1 Manual Verification

## Scope

Branch: `feature/phase3a-secure-image-delivery`

Release 1 covers the secure image delivery implementation through Task 10. This checklist is prepared before production release approval; no production smoke result is claimed here.

## Automated evidence

- `npm.cmd run check`: passed, 46 test files / 204 tests.
- `npm.cmd run build`: passed.
- `npm.cmd exec wrangler -- deploy --dry-run`: passed; Wrangler read 17 client assets, reported 147.71 KiB total upload / 32.65 KiB gzip, listed DB/MEDIA/IMAGES/ASSETS bindings, and exited without deploying.
- `git diff --check`: passed.
- Production-only audit: 0 vulnerabilities.
- Full audit: four high findings in the dev-only Miniflare/sharp dependency chain; see the dependency audit document.

## Owner and Guest matrix

- [ ] Owner: public image Thumbnail and Preview load.
- [ ] Owner: private image Thumbnail and Preview load.
- [ ] Owner: Original download uses the Original route only after an explicit download action.
- [ ] Guest: published Memory with public image loads Thumbnail and Preview.
- [ ] Guest: private or draft Memory returns 404 for image delivery.
- [ ] Guest: no image Original download action is rendered.
- [ ] Legacy image routes still work.

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

Production Owner/Guest smoke testing and production secret setup are intentionally pending. Do not merge to `main`, deploy, or claim production acceptance until the explicit Release 1 approval and `IMAGE_SOURCE_SIGNING_KEY` setup are complete.
