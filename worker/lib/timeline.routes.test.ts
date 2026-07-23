// @vitest-environment node

import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../env';
import worker from '../index';

const verifyToken = vi.hoisted(() => vi.fn());

vi.mock('@clerk/backend', () => ({ verifyToken }));

const schema = readFileSync('database/schema.sql', 'utf8');
const context = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;

let mf: Miniflare;
let db: D1Database;
let env: Env;

beforeEach(async () => {
  verifyToken.mockImplementation(async (token: string) => {
    if (token === 'owner-token') return { sub: 'owner-1' };
    if (token === 'non-owner-token') return { sub: 'non-owner-1' };
    throw new Error('Invalid token');
  });
  mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } };',
    d1Databases: { DB: '00000000-0000-0000-0000-000000000004' },
  });
  db = await mf.getD1Database('DB') as unknown as D1Database;
  env = { DB: db } as Env;

  for (const statement of schema
    .replace(/^\uFEFF/, '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !/^PRAGMA\s+foreign_keys\s*=/i.test(item))) {
    await db.prepare(statement).run();
  }

  await db.prepare(`
    INSERT INTO owners (clerk_user_id, email, display_name)
    VALUES ('owner-1', 'owner@example.com', 'Owner')
  `).run();
  await insertMemory('memory-public', '2026-07-20', 'published', [
    ['asset-fallback', 'image', 'public'],
    ['asset-replacement', 'image', 'public'],
    ['asset-private', 'image', 'private'],
    ['asset-video', 'video', 'public'],
  ]);
  await insertMemory('memory-draft', '2026-07-21', 'draft', [
    ['asset-draft', 'image', 'public'],
  ]);
  await insertMemory('memory-mismatch', '2025-07-20', 'published', [
    ['asset-mismatch', 'image', 'public'],
  ]);
  await db.prepare(`
    UPDATE media_assets SET sort_order = 1 WHERE id = 'asset-fallback'
  `).run();
  await insertCover('cover-existing', 'year', '2026', 'memory-public', 'asset-fallback');
});

afterEach(async () => {
  await mf.dispose();
});

describe('timeline cover routes', () => {
  it('returns the public timeline without authentication', async () => {
    const response = await fetchWorker('/api/timeline');

    expect(response.status).toBe(200);
    const timeline = await response.json() as { years: Array<Record<string, unknown>> };
    expect(timeline.years[0]).toMatchObject({
      key: '2026',
      cover: { assetId: 'asset-fallback', isExplicitCover: true },
    });
  });

  it('requires an owner session for cover mutations', async () => {
    const input = { periodType: 'year', periodKey: '2026', assetId: 'asset-replacement' };

    expect((await fetchWorker('/api/timeline/covers', { method: 'PUT', body: JSON.stringify(input) })).status).toBe(401);
    expect((await fetchWorker('/api/timeline/covers?periodType=year&periodKey=2026', { method: 'DELETE' })).status).toBe(401);
  });

  it('returns the existing non-owner response for both mutations', async () => {
    const init = { headers: { authorization: 'Bearer non-owner-token' } };
    const input = { periodType: 'year', periodKey: '2026', assetId: 'asset-replacement' };

    const put = await fetchWorker('/api/timeline/covers', {
      ...init,
      method: 'PUT',
      body: JSON.stringify(input),
    });
    const remove = await fetchWorker('/api/timeline/covers?periodType=year&periodKey=2026', {
      ...init,
      method: 'DELETE',
    });

    expect(put.status).toBe(403);
    await expect(put.json()).resolves.toEqual({ error: 'This Clerk account is not an authorized owner.' });
    expect(remove.status).toBe(403);
    await expect(remove.json()).resolves.toEqual({ error: 'This Clerk account is not an authorized owner.' });
  });

  it.each([
    ['private asset', 'asset-private', '2026'],
    ['video asset', 'asset-video', '2026'],
    ['draft memory', 'asset-draft', '2026'],
    ['memory date mismatch', 'asset-mismatch', '2026'],
  ])('rejects a %s without changing the cover row', async (_, assetId, periodKey) => {
    const response = await fetchWorker('/api/timeline/covers', {
      method: 'PUT',
      headers: { authorization: 'Bearer owner-token' },
      body: JSON.stringify({ periodType: 'year', periodKey, assetId }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.any(String) });
    await expect(currentCover()).resolves.toMatchObject({
      id: 'cover-existing', memory_id: 'memory-public', asset_id: 'asset-fallback', created_by: 'owner-1',
    });
  });

  it('upserts a public image cover and preserves the first creator', async () => {
    const response = await fetchWorker('/api/timeline/covers', {
      method: 'PUT',
      headers: { authorization: 'Bearer owner-token' },
      body: JSON.stringify({ periodType: 'year', periodKey: '2026', assetId: 'asset-replacement' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      periodType: 'year', periodKey: '2026', assetId: 'asset-replacement',
    });
    await expect(currentCover()).resolves.toMatchObject({
      id: 'cover-existing', memory_id: 'memory-public', asset_id: 'asset-replacement', created_by: 'owner-1',
    });
    await expect(db.prepare('SELECT cover_asset_id FROM memories WHERE id = ?').bind('memory-public').first<{ cover_asset_id: string }>())
      .resolves.toEqual({ cover_asset_id: 'asset-fallback' });

    const firstInsert = await fetchWorker('/api/timeline/covers', {
      method: 'PUT',
      headers: { authorization: 'Bearer owner-token' },
      body: JSON.stringify({ periodType: 'month', periodKey: '2026-07', assetId: 'asset-replacement' }),
    });
    expect(firstInsert.status).toBe(200);
    await expect(db.prepare(`
      SELECT created_by FROM timeline_covers
      WHERE period_type = 'month' AND period_key = '2026-07'
    `).first<{ created_by: string }>()).resolves.toEqual({ created_by: 'owner-1' });
  });

  it('clears an existing cover idempotently and returns to the public fallback', async () => {
    const init = { method: 'DELETE', headers: { authorization: 'Bearer owner-token' } };

    expect((await fetchWorker('/api/timeline/covers?periodType=year&periodKey=2026', init)).status).toBe(204);
    expect((await fetchWorker('/api/timeline/covers?periodType=year&periodKey=2026', init)).status).toBe(204);
    await expect(currentCover()).resolves.toBeNull();

    const timeline = await fetchWorker('/api/timeline');
    const body = await timeline.json() as { years: Array<Record<string, unknown>> };
    expect(body.years[0]).toMatchObject({
      key: '2026',
      cover: { assetId: 'asset-replacement', isExplicitCover: false },
    });
  });
});

function fetchWorker(path: string, init: RequestInit = {}): Promise<Response> {
  return worker.fetch(new Request(`https://example.com${path}`, init), env, context);
}

async function currentCover(): Promise<Record<string, string> | null> {
  return db.prepare(`
    SELECT id, memory_id, asset_id, created_by
    FROM timeline_covers
    WHERE period_type = 'year' AND period_key = '2026'
  `).first<Record<string, string>>();
}

async function insertMemory(
  id: string,
  takenAt: string,
  status: 'draft' | 'published',
  assets: Array<[string, 'image' | 'video', 'public' | 'private']>,
): Promise<void> {
  await db.prepare(`
    INSERT INTO memories (
      id, title, description, location, taken_at, category, visibility,
      is_featured, status, cover_asset_id, created_by
    ) VALUES (?, ?, '', 'Somewhere', ?, 'Travel', 'public', 0, ?, ?, 'owner-1')
  `).bind(id, id, takenAt, status, assets[0]![0]).run();
  for (const [assetId, mediaType, visibility] of assets) {
    await db.prepare(`
      INSERT INTO media_assets (
        id, memory_id, media_type, object_key, original_filename,
        mime_type, size_bytes, sort_order, visibility
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?)
    `).bind(
      assetId, id, mediaType, `originals/owner-1/${assetId}`,
      `${assetId}.${mediaType === 'video' ? 'mp4' : 'jpg'}`,
      mediaType === 'video' ? 'video/mp4' : 'image/jpeg', visibility,
    ).run();
  }
}

async function insertCover(
  id: string,
  periodType: 'year' | 'month',
  periodKey: string,
  memoryId: string,
  assetId: string,
): Promise<void> {
  await db.prepare(`
    INSERT INTO timeline_covers (id, period_type, period_key, memory_id, asset_id, created_by)
    VALUES (?, ?, ?, ?, ?, 'owner-1')
  `).bind(id, periodType, periodKey, memoryId, assetId).run();
}
