# Phase 2B Upload Workflow UI Design

**Date:** 2026-07-21  
**Branch:** `feature/photo-upload-review-ui`  
**Base commit:** `bcc2ee7`  
**Status:** Approved for implementation planning

## 1. Goal

Connect the Phase 2A photo-upload foundation to the real Owner workflows:

1. Create a new photo-only Memory from Owner Studio.
2. Add photos to an existing Memory.
3. Review a completed Upload Session before confirmation.
4. Resume unfinished Create and Append Sessions.
5. Preserve selected local photo previews while navigating between workflow routes.
6. Recover safely after a browser refresh without re-uploading completed files.

The existing legacy media uploader remains available for any selection containing video.

## 2. Confirmed Product Rules

- A pure-photo selection uses the Upload Session workflow.
- A selection containing video uses the existing legacy workflow.
- A pure-photo selection may contain 1–100 photos.
- A Memory may contain at most 1,000 finalized Assets.
- New Append photos are added after existing Assets.
- Review ordering applies only to the new Session batch.
- Every selected photo defaults to Private.
- Exact duplicates are skipped by default.
- An Owner may explicitly choose “Still add” for a skipped duplicate.
- Pending Session files are never mixed into the public or private Memory gallery.
- A Session must reach `review` before it can be confirmed.
- Create confirmation creates a new Memory atomically.
- Append confirmation adds the accepted photos atomically.
- A proposed cover is applied only at confirmation.
- A Private photo may be selected as the Owner cover.
- Guest cover fallback behavior remains a later delivery concern.

## 3. Scope

### Included

- Shared in-memory upload workflow Provider.
- Studio photo-only Create flow.
- Existing Memory Add Photos flow.
- Dedicated Review route.
- Active Session recovery UI.
- Reselect-original-files flow after refresh.
- Duplicate override.
- Per-photo visibility.
- Review ordering for the new batch.
- Proposed cover selection.
- Confirm and abandon actions.
- English and Chinese copy.
- Unit, integration-style component, route, and build verification.

### Excluded

- HEIC rendering or conversion.
- Authenticated R2 image proxying.
- Server-generated Session thumbnails.
- IndexedDB persistence of original photo blobs.
- LocalStorage persistence of photo blobs.
- Video migration to Upload Sessions.
- Reordering existing Memory Assets.
- Pagination changes.
- Cleanup cron jobs.
- Production deployment.

## 4. Architecture

### 4.1 Provider placement

Add `PhotoSessionUploadProvider` above `<Routes>` and below the existing application providers.

The Provider owns one active local photo workflow at a time:

```text
App
└── BrowserRouter
    ├── Header
    └── PhotoSessionUploadProvider
        └── Routes
            ├── StudioPage
            ├── MemoryDetailPage
            ├── AddPhotosPage
            └── UploadSessionReviewPage
```

The Provider wraps the Phase 2A `usePhotoSessionUpload` state and exposes a stable context API.

### 4.2 Provider responsibilities

The Provider stores:

- selected local `File` objects
- generated preview object URLs
- resume fingerprints
- SHA-256 hashes
- local-to-Session file bindings
- local upload status
- active `UploadSession`
- current workflow origin
- current target Memory for Append
- progress and user-facing error state

The Provider performs:

- selection preparation
- Create Session creation
- Append Session creation
- Session resume matching
- upload of pending files
- visibility changes
- duplicate override
- local removal or server skip
- state reset
- object URL cleanup

### 4.3 Provider constraints

- Only one active local workflow is held in memory.
- Starting a second workflow requires the first workflow to be completed, abandoned, or explicitly discarded.
- The Provider must never silently discard selected `File` objects.
- The Provider must revoke object URLs only when the workflow is reset, replaced, abandoned, completed, or the application unmounts.
- Route transitions must not revoke previews.
- Completed or skipped server files must not be uploaded again.

## 5. Routes

Add two routes:

```text
/memory/:memoryId/add-photos
/upload-sessions/:sessionId/review
```

The existing `/studio` route remains the Create entry point.

### 5.1 Add Photos route

Only signed-in Owners may use it.

Responsibilities:

- load the target Memory from the existing Memories query
- load active Upload Sessions
- detect an unfinished Append Session for the Memory
- offer Resume or Abandon when one exists
- allow a new pure-photo selection when none exists
- create the Append Session
- upload pending accepted photos
- navigate to Review when the Session reaches `review`

### 5.2 Review route

Only signed-in Owners may use it.

Responsibilities:

- load the server Session by ID
- bind to Provider local files when the same Session is already in memory
- show all Session records in review order
- allow reordering only within the Session batch
- allow per-photo Public/Private changes
- allow duplicate override
- allow inclusion/removal changes
- allow proposed cover selection
- save review state
- confirm the Session
- abandon the Session
- navigate to the resulting Memory after confirmation

## 6. Studio Create Flow

### 6.1 Selection routing

When files are selected:

- call `classifySelection(files)`
- `photo-session`:
  - prepare fingerprints and hashes
  - store the selection in the Provider
  - render `PhotoPreviewGrid`
- `legacy-media`:
  - continue using the existing Studio legacy uploader unchanged

The file input copy changes from “up to 20 files” to clearly communicate:

- photos only: up to 100
- selections containing video: up to 20

### 6.2 Create workflow

For a pure-photo selection:

1. Owner fills title, location, date, category, description, featured, and target status.
2. Owner chooses Save Draft or Publish.
3. Studio creates a Create Upload Session with those metadata values.
4. Server returns duplicate decisions.
5. Studio displays duplicate states.
6. Upload coordinator uploads accepted pending photos.
7. When all files are uploaded or skipped, the Session reaches `review`.
8. Navigate to `/upload-sessions/:sessionId/review`.
9. Memory is not visible until Review confirmation.

### 6.3 Legacy workflow

The existing direct-upload and `createMemory` path remains intact for any supported selection containing video.

No photo Session code may alter the behavior of the legacy video path in Phase 2B.

## 7. Existing Memory Add Photos Flow

### 7.1 Entry point

Add an Owner-only `Add photos` action near the Memory heading.

The action navigates to:

```text
/memory/:memoryId/add-photos
```

### 7.2 Active Append Session

The backend permits one active Append Session per Memory.

When an active Session exists, show:

- current status
- completed count / expected count
- last updated time
- `Resume`
- `Abandon`

Do not show a second “start upload” form until the active Session is resolved.

### 7.3 New Append workflow

1. Select 1–100 photos.
2. Prepare fingerprints and hashes.
3. Create Append Session.
4. Display duplicates skipped by default.
5. Upload accepted pending files.
6. Navigate to Review when status becomes `review`.

Existing Memory Assets remain unchanged throughout this workflow.

## 8. Review Experience

### 8.1 Review card states

Each Session file renders one card:

- `uploaded`: included and ready
- `duplicate`: skipped by default, with `Still add`
- `skipped`: excluded by Owner
- `pending`: requires upload or reselection
- `failed`: retryable
- `authorized` or `uploading`: treated as incomplete and refreshable from server

### 8.2 Ordering

- Default order is `reviewSortOrder`.
- Drag and drop is used on pointer-capable devices.
- Move Up / Move Down controls are available for keyboard and mobile users.
- Only uploaded and included photos affect final order.
- Skipped items may remain visually grouped at the end while retaining their stored review order.
- Existing Memory Assets are never part of this reorder operation.

### 8.3 Visibility

Each included photo has a Public/Private toggle.

- default: Private
- update local state immediately
- persist during Save Review
- clearly show a privacy warning when one or more photos are Public

### 8.4 Duplicate override

For a duplicate skipped by default:

- show `Duplicate — skipped`
- show `Still add`
- selecting `Still add` sets:
  - `allowDuplicate: true`
  - `skipped: false`
- if the file is not present locally after refresh, the Owner must reselect originals before it can upload

### 8.5 Cover

- Create Session requires a valid included uploaded cover.
- Default Create cover is the first included uploaded photo.
- Append Session may leave proposed cover unset.
- Selecting a Session photo as cover does not change the Memory until confirmation.
- A skipped photo cannot be selected as cover.
- If the selected cover is later skipped, clear the proposed cover.

### 8.6 Review save

Before confirmation, call `PATCH /review` with every Session file:

- `sessionFileId`
- `reviewSortOrder`
- `targetVisibility`
- `allowDuplicate`
- `skipped`

Also send `proposedCoverSessionFileId`.

### 8.7 Confirmation

On successful confirmation:

- invalidate `['memories']`
- invalidate `['upload-sessions']`
- reset Provider local workflow
- navigate to `/memory/:memoryId`

The confirmation button is disabled when:

- any included file is not uploaded
- no photo is included
- Create has no valid cover
- save is in progress
- confirm is in progress

## 9. Refresh and Resume Behavior

### 9.1 Navigation without refresh

Because the Provider is above `<Routes>`, Studio or Add Photos can navigate to Review while preserving:

- local `File` objects
- object URL previews
- hashes
- Session bindings
- upload state

Review displays full thumbnails immediately.

### 9.2 Browser refresh

After a refresh, the Provider has no local files.

The Review route still loads the server Session and shows:

- filename
- size
- current status
- visibility
- duplicate state
- inclusion state
- order
- cover selection metadata

For uploaded photos without local files, show a non-image placeholder because Phase 2 does not include authenticated Session image delivery.

### 9.3 Reselect originals

When any Session file still needs a local `File`, show:

```text
Reselect original photos
```

The Owner selects the original complete batch.

The application:

1. prepares fingerprints
2. calls `/match`
3. requires no missing Session IDs
4. requires no unmatched local IDs
5. binds each local file to its Session file
6. restores previews
7. uploads only pending or failed accepted files

Uploaded and skipped files are never uploaded again.

### 9.4 Partial reselection

Phase 2B does not support selecting only a subset for resume.

The Owner must reselect the complete original batch so occurrence indexes and duplicate filenames remain unambiguous.

## 10. Active Session Recovery UI

### 10.1 Studio

At the top of Studio, show unfinished Create Sessions.

Each item includes:

- title or “Untitled upload”
- status
- completed / expected count
- last updated time
- Resume
- Abandon

Resume behavior:

- `review` → navigate directly to Review
- `uploading` → navigate to Review, which requests original reselection if local files are absent

### 10.2 Memory Detail

When the Memory has an active Append Session:

- change `Add photos` to `Continue adding photos`
- show progress
- navigate to the existing Session workflow

## 11. Error Handling

### Selection errors

Show the exact filename and constraint:

- unsupported type
- over 100 photos
- over 50 MiB image
- video selection over 20
- invalid mixed selection

### Session conflicts

For HTTP 409 active Append conflict:

- refresh active Session query
- present the existing Session
- do not create another Session

### Upload errors

- show per-photo failed state
- keep completed uploads
- allow retry
- record failure with backend
- reauthorize expired 401/403 upload URLs
- never restart already uploaded files

### Review errors

- keep local review state
- show the server message
- allow retry
- do not navigate away

### Abandon errors

- only reset local state after the abandon API succeeds
- if backend reports cleanup deferred, preserve the warning and refresh Session state

## 12. Accessibility

- Every icon-only action has an accessible name.
- Reordering works without drag and drop.
- Progress uses `aria-live`.
- Errors use `role="alert"`.
- Visibility toggles use `aria-pressed`.
- Session cards retain visible focus.
- Mobile controls meet practical touch target sizing.
- Review is usable at 320 px width.
- The 100-photo grid remains bounded and scrollable.

## 13. Internationalization

Add English and Chinese keys for:

- Add Photos entry
- Continue existing Session
- Resume Session
- Abandon Session
- Reselect originals
- duplicate skipped
- Still add
- Review photos
- Save review
- Confirm Memory
- Confirm photo addition
- move up / move down
- set cover / selected cover
- upload progress
- pending / failed / uploaded / skipped
- refresh recovery instructions
- public-photo privacy warning

No user-facing Phase 2B string should be hard-coded directly in page components.

## 14. Component Boundaries

### New components

- `PhotoSessionUploadProvider`
- `usePhotoSessionUploadContext`
- `ActiveUploadSessions`
- `PhotoSelectionPanel`
- `SessionProgressBanner`
- `UploadSessionReviewGrid`
- `UploadSessionReviewCard`
- `SessionFilePlaceholder`
- `ReviewActions`
- `AddPhotosPage`
- `UploadSessionReviewPage`

### Existing components reused

- `PhotoPreviewGrid`
- `UploadStats`
- existing button, form, badge, and Memory styles

### Existing pages changed

- `App`
- `StudioPage`
- `MemoryDetailPage`

## 15. Testing Strategy

### Pure unit tests

- Provider reducer or state transitions
- Session resume selection
- cover validity
- reorder operations
- confirm eligibility
- translation completeness
- route helper behavior

### Component tests

- Active Create Session list
- active Append Session presentation
- Review placeholder after refresh
- duplicate override
- visibility changes
- keyboard reorder
- confirm disabled states

### Workflow tests

- Studio pure photos → Session Review
- Studio video selection → legacy path
- Add Photos → Append Review
- refresh → server Session → reselect originals
- already uploaded files are not re-uploaded
- duplicate override uploads only the overridden file
- confirmation invalidates queries and navigates

### Final verification

- targeted Phase 2B tests
- complete `npm run check`
- production `npm run build`
- `git diff --check`
- manual local Owner walkthrough before push

## 16. Acceptance Criteria

Phase 2B is complete when all of the following are true:

1. Studio accepts up to 100 pure photos through Upload Sessions.
2. Studio selections containing video still use the existing path.
3. Memory Detail provides an Owner-only Add Photos workflow.
4. One active Append Session is visibly resumed rather than duplicated.
5. Upload status survives route navigation.
6. Review displays local thumbnails without a refresh.
7. Review remains usable after refresh through server metadata and original-file reselection.
8. Already uploaded files are never re-uploaded during resume.
9. Duplicate files are skipped by default and can be explicitly included.
10. Per-photo visibility is saved.
11. New-batch order is saved.
12. Proposed cover is saved and applied only on confirmation.
13. Create and Append confirmation navigate to the resulting Memory.
14. Abandon removes the Session through the backend.
15. English and Chinese UI are complete.
16. All tests and production build pass.
17. Nothing is deployed until the branch is reviewed and merged.
