// @vitest-environment node

import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../env';
import { listMemoryFacets } from './memories';

const schema = readFileSync('database/schema.sql', 'utf8');

let mf: Miniflare;
let db: D1Database;
let env: Env;

beforeEach(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } };',
    d1Databases: { DB: '00000000-0000-0000-0000-000000000003' },
  });
  db = await mf.getD1Database('DB') as unknown as D1Database;
  env = { DB: db } as Env;

  for (const statement of schema
    .replace(/^\uFEFF/, '')
    .split(';')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => !/^PRAGMA\s+foreign_keys\s*=/i.test(item))) {
    await db.prepare(statement).run();
  }

  await db.prepare(`
    INSERT INTO owners (clerk_user_id, email, display_name)
    VALUES ('owner-1', 'owner@example.com', 'Owner')
  `).run();
});

afterEach(async () => {
  await mf.dispose();
});

describe('listMemoryFacets', () => {
  it('returns owner-aware facets', async () => {
    await insertMemory('guest-april', '2026-04-03', 'public');
    await insertMemory('guest-may', '2026-05-03', 'public');
    await insertMemory('owner-private', '2025-03-03', 'private');

    await expect(listMemoryFacets(env, false)).resolves.toEqual({
      years: [{ year: 2026, months: [4, 5] }],
    });
    await expect(listMemoryFacets(env, true)).resolves.toEqual({
      years: [
        { year: 2025, months: [3] },
        { year: 2026, months: [4, 5] },
      ],
    });
  });
});

async function insertMemory(
  id: string,
  takenAt: string,
  assetVisibility: 'public' | 'private',
): Promise<void> {
  const assetId = `${id}-asset`;
  await db.prepare(`
    INSERT INTO memories (
      id, title, description, location, taken_at, category, visibility,
      is_featured, status, cover_asset_id, created_by
    ) VALUES (?, ?, '', '', ?, 'Travel', 'private', 0, 'published', ?, 'owner-1')
  `).bind(id, id, takenAt, assetId).run();
  await db.prepare(`
    INSERT INTO media_assets (
      id, memory_id, media_type, object_key, original_filename,
      mime_type, size_bytes, sort_order, visibility
    ) VALUES (?, ?, 'image', ?, 'photo.jpg', 'image/jpeg', 1, 0, ?)
  `).bind(assetId, id, `originals/owner-1/${assetId}.jpg`, assetVisibility).run();
}
