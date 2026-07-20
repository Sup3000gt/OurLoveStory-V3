# Our Story Private Media Gallery Design

## Purpose
A warm, premium couple journal that publicly presents selected memories while allowing exactly two invited owners to sign in, see private memories, upload photos/videos, download originals, and manage metadata.

## Product rules
- No public registration.
- Two independent owner accounts.
- Guests see only published public memories.
- Owners see public and private memories and Owner Studio.
- Private media must never use permanent public object URLs.
- Each memory can contain multiple photos and videos.
- Required metadata: title, date, location, category, visibility; optional description and featured flag.
- Categories: Travel, Daily Life, Homemade Food, Dining Out, Special Moments.
- Original download inherits memory visibility.

## Architecture
React/Vite UI deployed on Cloudflare. Clerk handles owner identity. Cloudflare D1 stores metadata. Cloudflare R2 stores original media in a private bucket. A Worker API verifies Clerk sessions, checks the owner allowlist in D1, and issues short-lived upload/download access.

## Pages
- `/`: premium editorial home and public/owner-aware memory grid.
- `/gallery`: category filter and all visible memories.
- `/studio`: protected upload form with live preview.
- Future: `/memory/:id`, owner edit/delete, video transcoding via Cloudflare Stream.
