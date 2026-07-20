# Worker API Contract

All endpoints are same-origin under `/api`. Authenticated frontend calls include a Clerk session token as `Authorization: Bearer <token>`. Inline `<img>` and `<video>` requests can also be authenticated from Clerk's `__session` cookie.

The R2 bucket is private. Asset responses are streamed by the Worker after database visibility checks.

## Error shape

```json
{
  "error": "Human-readable message"
}
```

Unauthorized requests to a known private asset intentionally return `404` rather than confirming the asset exists.

## `GET /api/health`

Returns Worker health information.

```json
{ "ok": true, "service": "our-love-story" }
```

## `GET /api/session`

Returns Clerk and D1 owner status.

```json
{
  "signedIn": true,
  "isOwner": true,
  "userId": "user_123",
  "displayName": "Alan"
}
```

A valid Clerk account that is not present in `owners` receives `signedIn: true` and `isOwner: false`.

## `GET /api/memories`

Guests receive published public memories. Allowlisted owners receive public/private published memories and drafts.

```json
{
  "memories": [
    {
      "id": "uuid",
      "title": "Trip to Paris",
      "location": "Paris, France",
      "date": "2024-06-02",
      "description": "An unforgettable evening.",
      "category": "Travel",
      "visibility": "private",
      "featured": true,
      "status": "published",
      "coverAssetId": "asset-uuid",
      "assets": [
        {
          "id": "asset-uuid",
          "type": "image",
          "url": "/api/assets/asset-uuid",
          "downloadUrl": "/api/assets/asset-uuid/download",
          "filename": "IMG_1234.jpg",
          "mimeType": "image/jpeg",
          "sizeBytes": 123456,
          "sortOrder": 0
        }
      ],
      "createdAt": "2026-07-20 12:00:00",
      "updatedAt": "2026-07-20 12:00:00"
    }
  ]
}
```

## `GET /api/memories/:id`

Returns one accessible memory. Guests can only request published public memories. Owners can request private memories and drafts.

## `POST /api/uploads`

Owner-only. Validates the file manifest and returns one five-minute presigned R2 PUT URL per file.

Request:

```json
{
  "files": [
    {
      "filename": "IMG_1234.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 123456
    }
  ]
}
```

Response:

```json
{
  "uploads": [
    {
      "objectKey": "originals/user_123/2026/uuid.jpg",
      "uploadUrl": "https://ACCOUNT.r2.cloudflarestorage.com/...signed...",
      "headers": { "Content-Type": "image/jpeg" },
      "expiresAt": "2026-07-20T12:05:00.000Z",
      "mediaType": "image",
      "originalFilename": "IMG_1234.jpg",
      "sizeBytes": 123456
    }
  ]
}
```

The browser must `PUT` the exact file to `uploadUrl` with every returned header. R2 CORS must allow the app origin.

## `POST /api/memories`

Owner-only. Called after every direct R2 upload succeeds. The Worker verifies that each object exists, matches its declared size/content type, and belongs to the authenticated owner's key prefix before writing D1 records.

```json
{
  "title": "Trip to Paris",
  "location": "Paris, France",
  "date": "2024-06-02",
  "category": "Travel",
  "description": "An unforgettable evening.",
  "visibility": "private",
  "featured": true,
  "status": "published",
  "coverObjectKey": "originals/user_123/2026/uuid.jpg",
  "assets": [
    {
      "objectKey": "originals/user_123/2026/uuid.jpg",
      "originalFilename": "IMG_1234.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 123456,
      "mediaType": "image",
      "sortOrder": 0
    }
  ]
}
```

Returns the created `Memory`.

## `PATCH /api/memories/:id`

Owner-only. Accepts any non-empty subset of:

```json
{
  "title": "Updated title",
  "location": "Updated location",
  "date": "2024-06-03",
  "category": "Travel",
  "description": "Updated notes",
  "visibility": "public",
  "featured": false,
  "status": "published",
  "coverAssetId": "asset-uuid"
}
```

Returns the updated memory.

## `DELETE /api/memories/:id`

Owner-only. Deletes the D1 memory/assets transactionally through foreign-key cascade, then deletes associated R2 objects asynchronously.

Returns `204 No Content`.

## `GET|HEAD /api/assets/:id`

Streams an inline image/video after checking the parent memory's status and visibility. Supports request range and conditional headers through the R2 binding.

- Published public parent: guest access, short public cache
- Private or draft parent: allowlisted owner only, `private, no-store`
- Unauthorized/missing: `404`

## `GET|HEAD /api/assets/:id/download`

Uses the same authorization rules but returns an attachment `Content-Disposition` with a sanitized original filename.
