# Memory Timeline & Cover Verification

Date: 2026-07-22

## Scope

Task 8 verification for the Memory River timeline and owner-managed yearly/monthly covers. No remote migration, deployment, or push was performed.

## Implementation commits

- `4b2e1f2` — timeline cover schema and contracts
- `3b13214` — public memory timeline assembly
- `2138076` — owner timeline cover routes
- `513b4ca` — timeline client data layer
- `076586c` — timeline page and localized photo counts
- `6174215` — memory lightbox links and owner cover controls
- `69a7c97` — `/timeline` route and Journal navigation
- `a24dcfc` — Chinese timeline photo-count localization fix

## Automated verification

All commands were run from the repository root:

```text
npm.cmd run typecheck       PASS
npm.cmd test                PASS — 59 files, 262 tests
npm.cmd run build           PASS — SSR and client Vite builds
npm.cmd exec wrangler -- deploy --dry-run
                            PASS — 17 assets, 158.77 KiB upload / 35.19 KiB gzip
git diff --check            PASS
```

The Wrangler command was a dry run only. It did not deploy or change the remote D1 database.

## Browser verification

The local Vite/Cloudflare development server was opened at `http://127.0.0.1:4173/timeline` after initializing only the local D1 database from `database/schema.sql`.

- English timeline route loaded with the “A river of memories.” heading and the empty-state message for a database with no public memories.
- Chinese language toggle loaded the translated timeline heading and empty-state message.
- Header navigation exposed Journal at `/timeline`.
- Before local D1 initialization the endpoint returned 500 because the local database had no schema; after initialization the route returned the expected empty state.

The local database was not populated with production photos, so period cards, lightbox navigation, and owner cover mutations were validated by the automated route/component tests rather than by inventing local fixture data.

## Release note

For an existing remote D1 database, apply `database/migrations/0004_timeline_covers.sql` once during the release process. Do not run that remote migration as part of local verification.
