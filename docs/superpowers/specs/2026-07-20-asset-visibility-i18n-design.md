# Per-Asset Visibility and Bilingual UI Design

## Product behavior

- Every newly selected photo or video starts as `private`.
- Owners can set each asset to `public` or `private` before upload and from the Memory detail page.
- Guests see one card per Memory, but only Public assets inside a Published Memory.
- A Memory with no Public assets is invisible to guests.
- When the configured cover is Private, guests receive the first Public asset as the response cover.
- Owners always receive all assets and the real configured cover.
- Private asset URLs and filenames never appear in guest API responses.
- Public/private download authorization is enforced in the Worker, not only in React.

## Data model

`media_assets.visibility` becomes the source of truth. Existing assets inherit
the original `memories.visibility` value during migration. The old Memory
column remains temporarily for compatibility and new memories persist it as
`private`.

## Localization

The interface supports `zh` and `en` with a typed in-app dictionary. The
initial language comes from localStorage and then the browser locale. The
header provides a `中文 / EN` control. User-entered titles, locations,
descriptions, and filenames are never translated.

## Chinese voice

Chinese copy should sound warm, conversational, and personal rather than
literal or administrative. Examples include “保存这段回忆”, “仅我们可见”,
“正在翻找我们的回忆…”, and “没保存成功，再试一次吧。”

## Security

Guest list and detail queries filter to Public assets before aggregation.
Private inline and download requests return 404 to non-owners. Visibility
updates require a Clerk-authenticated allowlisted owner.
