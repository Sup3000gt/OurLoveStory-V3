# Our Story

A warm photo/video journal for two owners. Visitors can browse public memories; the two owners can sign in, see private memories, upload media, and download originals.

## Current implementation status

This first implementation includes:

- Responsive homepage matching the approved cream/blush editorial design
- Public gallery with category filtering
- Public/private memory behavior in demo mode
- Original-file download controls
- Owner Studio upload UI for multiple photos and videos
- Metadata fields: title, location, date, category, description, visibility, featured
- Live image/video preview
- D1 database schema for two owners, memories, and media assets
- Cloudflare R2/D1 deployment configuration scaffold
- Unit tests for date formatting and visibility rules

The login button currently toggles a local **demo owner session** so the UI can be reviewed before credentials exist. Production Clerk login and the R2 upload API are the next integration step.

## Local development

```bash
npm install
npm run dev
```

Open the printed local URL. Click **Owner login** to enter demo owner mode, then open **Owner Studio**.

## Accounts and services you need to create

### 1. Clerk

Create one Clerk application.

Configure it as follows:

1. Enable email + password sign-in.
2. Disable public sign-up / use restricted sign-up mode.
3. Manually create two users: one for you and one for your wife.
4. Copy the publishable key into `.env.local`:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

The backend secret will be stored as a Cloudflare secret, never in Git:

```bash
npx wrangler secret put CLERK_SECRET_KEY
```

### 2. Cloudflare account

Create these resources:

```bash
npx wrangler login
npx wrangler d1 create our-love-story
npx wrangler r2 bucket create our-love-story-media
```

Copy the D1 database ID into `wrangler.toml`, then apply the schema:

```bash
npx wrangler d1 execute our-love-story --remote --file=database/schema.sql
```

The R2 bucket must remain private. Public and private downloads will both pass through authorization logic; private files never receive permanent public URLs.

### 3. Add the two Clerk users to D1

After creating the two Clerk accounts, insert both Clerk user IDs and emails:

```sql
INSERT INTO owners (clerk_user_id, email, display_name)
VALUES
  ('user_YOUR_CLERK_ID', 'your-email@example.com', 'Alan'),
  ('user_WIFE_CLERK_ID', 'wife-email@example.com', 'Wife Name');
```

Run it through the D1 dashboard or `wrangler d1 execute`.

## Planned production upload flow

1. Owner signs in with Clerk.
2. Owner selects photos/videos in `/studio`.
3. Frontend requests an upload authorization from the Worker.
4. Worker verifies the Clerk session and the D1 owner allowlist.
5. Browser uploads directly to private R2 using a short-lived signed request.
6. Worker writes memory and media metadata to D1.
7. Public gallery queries only public records; owners query public + private records.
8. Original download endpoint checks visibility before streaming the R2 object.

## Repository safety

Never commit:

- Clerk secret key
- R2 access key or secret
- `.dev.vars`
- `.env.local`
- true private media files used for testing

## Deployment target

The intended production target is Cloudflare Workers/Pages connected to this GitHub repository. Pushes to `main` can trigger automatic builds after the Cloudflare Git integration is connected.
