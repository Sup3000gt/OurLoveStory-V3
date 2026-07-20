# Our Story

Our Story is a warm photo and video journal for two owners. Guests can browse memories marked **Public**. The two allowlisted owners can sign in, see **Private** memories, upload media directly from the Owner Studio, and download original files.

## What this version includes

- React 19 + TypeScript frontend with the approved cream/blush editorial design
- Clerk authentication with two independent owner accounts and no public registration
- Server-side owner allowlist stored in Cloudflare D1
- Private Cloudflare R2 bucket for photos and videos
- Browser-to-R2 uploads using five-minute presigned PUT URLs
- Public/private authorization on lists, detail pages, inline media, and original downloads
- Multi-file memories with one selected cover
- Travel, Daily Life, Homemade Food, Dining Out, and Special Moments categories
- Draft and published states
- Responsive gallery, memory detail page, and Owner Studio
- GitHub Actions typecheck, unit tests, and production build

## Architecture

```text
Browser
  ├─ React UI + Clerk session
  ├─ GET/POST /api/* ───────────────┐
  └─ PUT presigned URL ──────► R2   │
                                      ▼
Cloudflare Worker
  ├─ verifies Clerk session tokens
  ├─ checks the D1 owners allowlist
  ├─ reads/writes memory metadata in D1
  ├─ creates short-lived R2 upload URLs
  └─ streams authorized media/downloads from private R2
```

The R2 bucket must remain private. Hiding a card in React is not considered access control; all private media requests are authorized again by the Worker.

## Prerequisites

- Node.js 22+
- A Cloudflare account
- A Clerk account
- The two email addresses that will be used by the owners

Do not paste API keys into chat, issues, commits, or pull requests. Put local secrets in `.dev.vars` / `.env.local`, and production secrets in Cloudflare Worker secrets.

# Service setup

## 1. Create the Clerk application

1. Create one Clerk application.
2. Enable email and password sign-in.
3. Open **User & Authentication → Restrictions**.
4. Enable **Restricted** sign-up mode. Do not add a public sign-up page.
5. In Clerk's Users area, manually create or invite exactly two users: one for each owner.
6. Copy the **Publishable Key** and **Secret Key** from Clerk's API keys page.
7. Optional but recommended: copy the PEM **JWT public key** so the Worker can verify sessions without a Clerk network request.
8. For tighter account control, disable owner self-service changes to the email identifier in Clerk's User permissions.

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_or_live_value
VITE_API_BASE_URL=/api
```

Create `.dev.vars` from `.dev.vars.example`:

```bash
cp .dev.vars.example .dev.vars
```

```dotenv
CLERK_SECRET_KEY=sk_test_or_live_value
# Optional PEM public key; keep the line breaks exactly as Clerk provides them.
CLERK_JWT_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
R2_ACCESS_KEY_ID=local_or_production_r2_access_key
R2_SECRET_ACCESS_KEY=local_or_production_r2_secret
```

## 2. Create Cloudflare D1 and R2 resources

Authenticate Wrangler:

```bash
npm install
npx wrangler login
```

Create the database and bucket:

```bash
npx wrangler d1 create our-love-story
npx wrangler r2 bucket create our-love-story-media
```

Copy the D1 database ID returned by Wrangler into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "our-love-story"
database_id = "YOUR_REAL_D1_DATABASE_ID"
```

Replace these variables in `wrangler.toml`:

```toml
[vars]
R2_ACCOUNT_ID = "YOUR_CLOUDFLARE_ACCOUNT_ID"
R2_BUCKET_NAME = "our-love-story-media"
CLERK_AUTHORIZED_PARTIES = "http://localhost:5173,https://YOUR-PRODUCTION-DOMAIN"
```

`CLERK_AUTHORIZED_PARTIES` is a comma-separated list of the exact frontend origins allowed to issue sessions for this app. Add the final `workers.dev` or custom-domain origin before production testing.

Apply the schema locally and remotely:

```bash
npx wrangler d1 execute our-love-story --local --file=database/schema.sql
npx wrangler d1 execute our-love-story --remote --file=database/schema.sql
```

## 3. Add the two owners to D1

In Clerk, copy each user's ID (`user_...`). Make a temporary copy of `database/owners.example.sql`, replace the sample values, and execute it. Do not commit the real copy.

```bash
cp database/owners.example.sql database/owners.local.sql
# Edit database/owners.local.sql with the two Clerk user IDs and emails.
npx wrangler d1 execute our-love-story --local --file=database/owners.local.sql
npx wrangler d1 execute our-love-story --remote --file=database/owners.local.sql
```

`database/owners.local.sql` is ignored by Git.

## 4. Create an R2 API token for direct uploads

The Worker uses the R2 S3-compatible endpoint only to sign temporary browser upload URLs.

1. In Cloudflare, open **R2 → Manage R2 API Tokens**.
2. Create an API token with **Object Read & Write** permission limited to `our-love-story-media`.
3. Copy its Access Key ID and Secret Access Key.
4. Store them as Worker secrets; never expose them to the React app.

```bash
npx wrangler secret put CLERK_SECRET_KEY
npx wrangler secret put CLERK_JWT_KEY
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

`CLERK_JWT_KEY` is optional. When omitted, Clerk's backend SDK can retrieve signing keys using `CLERK_SECRET_KEY`.

## 5. Configure R2 browser-upload CORS

Presigned URLs authenticate an upload, but browsers still require the bucket to allow the site's origin. Copy `r2-cors.example.json`, replace the production origin, and apply it through the R2 dashboard or Wrangler.

```bash
cp r2-cors.example.json r2-cors.local.json
# Edit origins, then:
npx wrangler r2 bucket cors set our-love-story-media --file r2-cors.local.json
```

The policy only allows `PUT` with `Content-Type` from the origins you list. The generated signature also binds the requested MIME type.

# Local development

```bash
npm install
npm run dev
```

The Cloudflare Vite plugin runs the React application and Worker together. The frontend calls same-origin `/api/*` routes, so private images and video requests can use the Clerk session cookie.

Useful commands:

```bash
npm run typecheck
npm test
npm run check
npm run build
```

# Deploy

After replacing all placeholders and setting production secrets:

```bash
npm run deploy
```

The deployment contains both the Worker API and the Vite static assets. Cloudflare serves React routes as a single-page application and sends `/api/*` to the Worker first.

For Cloudflare Git builds, use:

```text
Build command: npm run build
Deploy command: npx wrangler deploy
```

Add `VITE_CLERK_PUBLISHABLE_KEY` as a build environment variable, and add the four runtime secrets from the previous section to the Worker. Never store secrets in `wrangler.toml`.

# Media rules

- Up to 20 files per memory
- Images: JPEG, PNG, WebP, or GIF, up to 50 MiB each
- Videos: MP4, MOV, or WebM, up to 2 GiB each
- Public memories are visible and downloadable by everyone
- Private memories and drafts are only returned to allowlisted owners
- Unauthorized private media requests return `404`
- Original filenames are sanitized before download headers are generated
- Public originals can include EXIF/GPS metadata; remove sensitive metadata before publishing

MOV and WebM playback depends on browser codec support. The original file is still downloadable. Cloudflare Stream transcoding is intentionally deferred until the family video library justifies it.

# Current limitations and next improvements

- HEIC files are not accepted yet because browsers cannot display them consistently without conversion
- No image resizing pipeline yet; originals are streamed for display and download
- No edit/delete UI yet, although authenticated Worker endpoints already support metadata updates and deletion
- No resumable multipart upload yet; very large videos should be added after a dedicated multipart workflow
- Orphaned objects from an interrupted client flow should later be removed by a scheduled cleanup job

See [API_CONTRACT.md](./API_CONTRACT.md) for endpoint details.
