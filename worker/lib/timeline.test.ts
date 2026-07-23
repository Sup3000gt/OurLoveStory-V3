// @vitest-environment node

import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../env';
import { listTimeline, selectTimelineCover, type TimelinePhotoRow } from './timeline';

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

  await insertMemory({
    id: 'memory-july',
    title: 'July memory',
    takenAt: '2026-07-20',
    createdAt: '2026-07-21 09:00:00',
    assets: [
      { id: 'july-old', sortOrder: 2, createdAt: '2026-07-21 09:00:00' },
      { id: 'july-new', sortOrder: 1, createdAt: '2026-07-22 09:00:00' },
      { id: 'july-private', sortOrder: 0, visibility: 'private' },
      { id: 'july-video', mediaType: 'video', sortOrder: 0 },
    ],
  });
  await insertMemory({
    id: 'memory-august',
    title: 'August memory',
    takenAt: '2026-08-01',
    createdAt: '2026-08-02 09:00:00',
    assets: [
      { id: 'august-public', sortOrder: 0 },
      { id: 'august-fallback', sortOrder: 1 },
    ],
  });
  await insertMemory({
    id: 'memory-draft',
    title: 'Draft memory',
    takenAt: '2026-08-15',
    status: 'draft',
    assets: [{ id: 'draft-public', sortOrder: 0 }],
  });
  await insertMemory({
    id: 'memory-2025',
    title: 'December memory',
    takenAt: '2025-12-31',
    assets: [{ id: 'december-public', sortOrder: 0 }],
  });

  await insertCover('cover-year-2026', 'year', '2026', 'memory-july', 'july-old');
  await insertCover('cover-month-july', 'month', '2026-07', 'memory-july', 'july-new');
  await insertCover('cover-month-august', 'month', '2026-08', 'memory-august', 'august-public');
  await db.prepare("UPDATE media_assets SET visibility = 'private' WHERE id = 'august-public'").run();
});

afterEach(async () => {
  await mf.dispose();
});

describe('listTimeline', () => {
  it('assembles public groups with valid explicit covers and deterministic fallbacks', async () => {
    const timeline = await listTimeline(env);

    expect(timeline.years.map((year) => year.key)).toEqual(['2026', '2025']);
    expect(timeline.years[0]?.months.map((month) => month.key)).toEqual(['2026-08', '2026-07']);
    expect(timeline.years[0]).toMatchObject({
      label: '2026',
      photoCount: 3,
      cover: {
        memoryId: 'memory-july',
        assetId: 'july-old',
        isExplicitCover: true,
        previewUrl: '/api/assets/july-old/preview',
        thumbnailUrl: '/api/assets/july-old/thumbnail',
      },
    });
    expect(timeline.years[0]?.months[0]).toMatchObject({
      year: '2026',
      month: 8,
      label: 'August',
      photoCount: 1,
      cover: {
        memoryId: 'memory-august',
        assetId: 'august-fallback',
        isExplicitCover: false,
      },
    });
    expect(timeline.years[0]?.months[1]).toMatchObject({
      year: '2026',
      month: 7,
      label: 'July',
      photoCount: 2,
      cover: {
        memoryId: 'memory-july',
        assetId: 'july-new',
        isExplicitCover: true,
      },
    });
    expect(timeline.years[1]).toMatchObject({
      photoCount: 1,
      cover: {
        memoryId: 'memory-2025',
        assetId: 'december-public',
        isExplicitCover: false,
      },
    });

    const visibleAssetIds = timeline.years.flatMap((year) => [
      year.cover.assetId,
      ...year.months.map((month) => month.cover.assetId),
    ]);
    expect(visibleAssetIds).not.toEqual(expect.arrayContaining([
      'july-private',
      'july-video',
      'draft-public',
      'august-public',
    ]));
  });
});

describe('selectTimelineCover', () => {
  it('uses the newest eligible photo with deterministic tie breakers when no explicit cover is valid', () => {
    const photos = [
      photo('asset-z', '2026-07-20', '2026-07-21 09:00:00', 1),
      photo('asset-a', '2026-07-20', '2026-07-21 09:00:00', 1),
      photo('older-photo', '2026-07-19', '2026-07-22 09:00:00', 0),
    ];

    expect(selectTimelineCover(photos, null)).toMatchObject({
      assetId: 'asset-a',
      isExplicitCover: false,
    });
  });
});

function photo(
  assetId: string,
  takenAt: string,
  createdAt: string,
  sortOrder: number,
): TimelinePhotoRow {
  return {
    memoryId: 'memory-1',
    memoryTitle: 'Memory',
    memoryDate: takenAt,
    memoryLocation: 'Somewhere',
    memoryCreatedAt: createdAt,
    assetId,
    filename: `${assetId}.jpg`,
    sortOrder,
  };
}

async function insertMemory(input: {
  id: string;
  title: string;
  takenAt: string;
  createdAt?: string;
  status?: 'draft' | 'published';
  assets: Array<{
    id: string;
    mediaType?: 'image' | 'video';
    visibility?: 'public' | 'private';
    sortOrder: number;
    createdAt?: string;
  }>;
}): Promise<void> {
  const coverAssetId = input.assets[0]?.id;
  await db.prepare(`
    INSERT INTO memories (
      id, title, description, location, taken_at, category, visibility,
      is_featured, status, cover_asset_id, created_by, created_at
    ) VALUES (?, ?, '', 'Somewhere', ?, 'Travel', 'public', 0, ?, ?, 'owner-1', ?)
  `).bind(
    input.id,
    input.title,
    input.takenAt,
    input.status ?? 'published',
    coverAssetId,
    input.createdAt ?? '2026-01-01 00:00:00',
  ).run();

  for (const asset of input.assets) {
    await db.prepare(`
      INSERT INTO media_assets (
        id, memory_id, media_type, object_key, original_filename,
        mime_type, size_bytes, sort_order, visibility, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).bind(
      asset.id,
      input.id,
      asset.mediaType ?? 'image',
      `originals/owner-1/${asset.id}`,
      `${asset.id}.${asset.mediaType === 'video' ? 'mp4' : 'jpg'}`,
      asset.mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
      asset.sortOrder,
      asset.visibility ?? 'public',
      asset.createdAt ?? input.createdAt ?? '2026-01-01 00:00:00',
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
