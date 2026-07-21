# Phase 2B Manual Verification

## Preconditions

- Run from `D:\Downloads\OurLoveStory-V3-phase2-photo-upload-ui`.
- Branch is `feature/photo-upload-review-ui`.
- Owner is signed into the local application.
- Local Worker uses local D1 and R2; do not target production.
- Keep DevTools Network open and filter for `upload-sessions`.

## Scenario 1: Create with pure photos

1. Open `/studio`.
2. Select three JPEG photos.
3. Confirm all three default to Private.
4. Fill title, location, date, and category.
5. Publish.
6. Confirm navigation to `/upload-sessions/<id>/review`.
7. Confirm all three thumbnails remain visible.
8. Move photo 3 before photo 1.
9. Make photo 2 Public.
10. Select photo 3 as cover.
11. Confirm.
12. Confirm navigation to the new Memory.
13. Confirm final order, visibility, and cover.

## Scenario 2: Legacy video preservation

1. Open `/studio`.
2. Select one MP4 and one JPEG.
3. Confirm the legacy preview UI appears.
4. Save the Memory.
5. Confirm no Upload Session review route is used.

## Scenario 3: Append photos

1. Open an existing Memory as Owner.
2. Select Add photos.
3. Select two new JPEG photos.
4. Confirm navigation to Review.
5. Confirm existing Asset order is not displayed as reorderable.
6. Reverse only the two new photos.
7. Confirm.
8. Confirm both appear after all existing Assets.

## Scenario 4: Duplicate

1. Add a photo whose content hash already exists in the target Memory.
2. Confirm it shows Duplicate — skipped.
3. Confirm it is not uploaded.
4. Select Still add.
5. Save the Review state.
6. Confirm it becomes pending and Retry or Reselect is offered.
7. Upload the duplicate.
8. Confirm and verify a second Asset exists.

## Scenario 5: Refresh recovery

1. Start a five-photo upload.
2. Close or refresh after at least two photos are recorded uploaded.
3. Open the Session Review route.
4. Confirm server filenames and statuses remain visible.
5. Confirm missing previews show placeholders.
6. Select Reselect original photos.
7. Select the complete original five-photo batch.
8. Confirm only pending or failed files receive new PUT requests.
9. Confirm already uploaded and skipped files receive no PUT request.
10. Finish Review and confirm.

## Scenario 6: Active Append Session

1. Start adding photos to a Memory.
2. Leave before confirmation.
3. Return to the Memory.
4. Confirm Add photos reads Continue adding photos.
5. Confirm progress is visible.
6. Open the active Session.
7. Confirm a second Append Session cannot be started.

## Scenario 7: Abandon

1. Start a Create or Append Session.
2. Select Abandon.
3. Confirm the warning.
4. Confirm the Session disappears from active recovery UI.
5. Confirm no Memory or Asset was created.

## Scenario 8: Mobile and keyboard

1. Test at a 320 px viewport.
2. Confirm Review cards remain readable.
3. Confirm every action button is reachable.
4. Reorder using Move Up and Move Down without dragging.
5. Tab through every card control.
6. Confirm visible focus indicators.
7. Confirm action targets are at least 40 px high on mobile.