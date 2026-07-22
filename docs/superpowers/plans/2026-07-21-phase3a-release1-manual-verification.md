# Phase 3A Release 1 Manual Verification

## Scope

Branch: `feature/phase3a-secure-image-delivery`

Release 1 covers the secure image delivery implementation through Task 10. Production deployment was approved and completed on 2026-07-22.

## Automated evidence

- `npm.cmd run check`: passed, 46 test files / 206 tests.
- `npm.cmd run build`: passed.
- Current production build served `/assets/index-BpJT34I5.css` and `/assets/index-B3RSAvVN.js` on both domains.
- `git diff --check`: passed.
- Production-only audit: 0 vulnerabilities.
- Full audit: four high findings in the dev-only Miniflare/sharp dependency chain; see the dependency audit document.

## Production deployment evidence

- GitHub `main`: `13365bc76d783b5d932d8f7048a6d675b1279cf8`.
- Worker version: `d8d25ff4-a57a-4efd-be47-634caff816ab`, deployed at 100% traffic.
- `https://lucyandalan.com/api/health`: 200; Worker domain `/api/health`: 200.
- Both domains served the same CSS/JS asset hashes and the SPA memory route returned 200.
- Public image fixture `6bcc498c-8f40-4383-80b8-bbfe07d23cff`: Thumbnail and Preview returned 200 `image/webp` with public revalidation headers; Guest Original returned 404.
- The same fixture's legacy generic and `/download` routes returned 206 `image/jpeg`, preserving Release 1 compatibility.
- Private fixture `d4a94955-8519-4c43-b764-24df7b30a99f`: unauthenticated Thumbnail, Preview, Original, and `/download` returned 404 on both domains.
- A reversible Owner visibility smoke changed that private fixture to public, observed public Thumbnail/Preview 200 and Original 404 on both domains, then restored it to private and re-observed 404.
- Owner memory rendering loaded private thumbnails after authentication and exposed Original only through explicit `Download original` links.
- The persisted Session review loaded `IMG_1275.JPG` from `/api/upload-sessions/2006bff9-4519-4943-bf7b-a026522c540f/files/c5bc307c-02ed-4f76-9a16-5d46b36c84da/thumbnail` after refresh.
- Completing the Append Session added `IMG_1275.JPG` as asset `09592806-0adc-4bbd-889c-0ae9aef73d1a` in the Owner memory. Cleanup through the native confirmation dialog was not completed; this temporary smoke asset remains and is called out below.

## Owner and Guest matrix

- [x] Owner: public image Thumbnail and Preview load.
- [x] Owner: private image Thumbnail and Preview load.
- [x] Owner: Original download uses the Original route only after an explicit download action.
- [x] Guest: published Memory with public image loads Thumbnail and Preview.
- [x] Guest: private or draft Memory returns 404 for image delivery.
- [x] Guest: no image Original download action is rendered by the public contract (`originalUrl = null`).
- [x] Legacy image routes still work.

## Image processing and storage

- [ ] Normal iPhone image below 20 MB uses the Images binding path.
- [ ] Image above 20 MB exercises remote transform mode.
- [ ] Small image is not upscaled.
- [ ] GIF produces a static WebP derivative.
- [x] Session refresh displays the persisted Session Thumbnail.
- [ ] Create Session promotes thumbnails and schedules Preview generation.
- [x] Append Session promotes thumbnails and schedules Preview generation.
- [ ] Abandon removes Session Originals and Session Thumbnails.
- [ ] Asset deletion removes image Original, Thumbnail, and Preview while preserving video cleanup behavior.
- [ ] Memory deletion removes all image derivatives.

## Regression and privacy checks

- [ ] Video playback and legacy download remain unchanged.
- [ ] Network capture confirms normal browsing never requests `/original`.
- [ ] Retry changes only the image URL query and does not expose the Original URL.

## Gate status

Task 11 remains open for the following evidence: normal/large/GIF processing modes, Create Session, Abandon cleanup, asset and Memory deletion, video playback/download, network proof that normal browsing never requests `/original`, and Retry URL privacy. The temporary Append smoke asset `IMG_1275.JPG` remains because the browser's native delete confirmation could not be completed reliably; it must be removed before claiming deletion evidence. Release 2 secure cutover remains unapproved and must not proceed until the remaining Release 1 checks are completed and explicitly approved.
