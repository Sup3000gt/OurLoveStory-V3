# Worker API Contract

## GET /api/memories
Returns published public memories for guests; public and private memories for allowlisted owners.

## POST /api/uploads
Owner-only. Accepts metadata (`filename`, `mimeType`, `sizeBytes`) and returns a server-generated object key plus short-lived upload authorization.

## POST /api/memories
Owner-only. Creates one memory and its uploaded media asset records.

## PATCH /api/memories/:id
Owner-only. Updates metadata, ordering, visibility, cover, featured status, or draft/published status.

## DELETE /api/memories/:id
Owner-only. Deletes D1 records and associated R2 objects.

## GET /api/assets/:id
Returns an optimized display stream after checking memory visibility.

## GET /api/assets/:id/download
Returns the original object with `Content-Disposition: attachment`. Public memories are available to guests. Private memories require an allowlisted owner session. Unauthorized private IDs return 404.
