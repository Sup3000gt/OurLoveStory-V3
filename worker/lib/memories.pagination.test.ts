// @vitest-environment node

import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../env';
import { decodeMemoryCursor } from './memory-pagination';
import { listMemories } from './memories';

const schema = readFileSync('database/schema.sql', 'utf8');

let mf: Miniflare;
let db: D1Database;
let env: Env;

beforeEach(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } };',
    d1Databases: { DB: '00000000-0000-0000-0000-000000000002' },
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

  await insertMemory('memory-1', '2026-07-03', 'public-1', 'public');
  await insertMemory('memory-2', '2026-07-02', 'public-2', 'public');
  await insertMemory('memory-private', '2026-07-01', 'private-1', 'private');
  await insertMemory('memory-3', '2026-06-30', 'public-3', 'public');
});

afterEach(async () => {
  await mf.dispose();
});

describe('listMemories pagination', () => {
  it('returns a stable next cursor and continues after the cursor', async () => {
    const firstPage = await listMemories(env, false, { limit: 2 });

    expect(firstPage.memories.map((memory) => memory.id)).toEqual([
      'memory-1',
      'memory-2',
    ]);
    expect(firstPage.nextCursor).toBeTruthy();

    const cursor = decodeMemoryCursor(firstPage.nextCursor);
    expect(cursor?.id).toBe('memory-2');

    const secondPage = await listMemories(env, false, {
      limit: 2,
      cursor: firstPage.nextCursor,
    });

    expect(secondPage.memories.map((memory) => memory.id)).toEqual(['memory-3']);
    expect(secondPage.nextCursor).toBeNull();
  });

  it('does not let Guest pagination reveal private or draft memories', async () => {
    const guestPage = await listMemories(env, false, { limit: 10 });
    const ownerPage = await listMemories(env, true, { limit: 10 });

    expect(guestPage.memories.map((memory) => memory.id)).not.toContain('memory-private');
    expect(ownerPage.memories.map((memory) => memory.id)).toContain('memory-private');
  });

  it('paginates only the requested category', async () => {
    await insertMemory('memory-food-1', '2026-06-29', 'food-1', 'public', 'Homemade Food');
    await insertMemory('memory-food-2', '2026-06-28', 'food-2', 'public', 'Homemade Food');

    const firstPage = await listMemories(env, false, {
      category: 'Homemade Food',
      limit: 1,
    });
    const secondPage = await listMemories(env, false, {
      category: 'Homemade Food',
      limit: 1,
      cursor: firstPage.nextCursor,
    });

    expect(firstPage.memories.map((memory) => memory.id)).toEqual(['memory-food-1']);
    expect(secondPage.memories.map((memory) => memory.id)).toEqual(['memory-food-2']);
    expect(secondPage.nextCursor).toBeNull();
  });

  it('returns only public memories from the requested month', async () => {
    await insertMemory('memory-april-1', '2026-04-20', 'april-1', 'public');
    await insertMemory('memory-april-2', '2026-04-08', 'april-2', 'public');
    await insertMemory('memory-april-private', '2026-04-05', 'april-private', 'private');
    await insertMemory('memory-may', '2026-05-01', 'may-1', 'public');

    const page = await listMemories(env, false, {
      month: '2026-04',
      limit: 10,
    });

    expect(page.memories.map((memory) => memory.id)).toEqual([
      'memory-april-1',
      'memory-april-2',
    ]);
    expect(page.nextCursor).toBeNull();
  });
});

async function insertMemory(
  id: string,
  takenAt: string,
  assetId: string,
  assetVisibility: 'public' | 'private',
  category: 'Travel' | 'Daily Life' | 'Homemade Food' | 'Dining Out' | 'Special Moments' = 'Travel',
): Promise<void> {
  await db.prepare(`
    INSERT INTO memories (
      id, title, description, location, taken_at, category, visibility,
      is_featured, status, cover_asset_id, created_by
    ) VALUES (?, ?, '', '', ?, ?,  'private', 0, 'published', ?, 'owner-1')
  `).bind(id, id, takenAt, category, assetId).run();
  await db.prepare(`
    INSERT INTO media_assets (
      id, memory_id, media_type, object_key, original_filename,
      mime_type, size_bytes, sort_order, visibility
    ) VALUES (?, ?, 'image', ?, 'photo.jpg', 'image/jpeg', 1, 0, ?)
  `).bind(assetId, id, `originals/owner-1/${assetId}.jpg`, assetVisibility).run();
}
