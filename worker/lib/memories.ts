import {
  MEMORY_CATEGORIES,
  type CreateMemoryRequest,
  type DeleteAssetResponse,
  type Memory,
  type MemoryAsset,
  type UpdateAssetVisibilityResponse,
  type UpdateMemoryRequest,
} from '../../shared/contracts';
import type { Env, OwnerIdentity } from '../env';
import { optionalOwner } from './auth';
import { planAssetDeletion } from './asset-deletion';
import { resolveVisibleCoverAssetId } from './asset-visibility';
import { HttpError, noContent, notFound } from './responses';
import {
  assertOwnedObjectKey,
  sanitizeDownloadFilename,
  validateAssetVisibilityUpdate,
  validateCreateMemoryRequest,
  ValidationError,
} from './validation';

interface JoinedMemoryRow {
  memory_id: string;
  title: string;
  description: string;
  location: string;
  taken_at: string;
  category: Memory['category'];
  visibility: Memory['visibility'];
  is_featured: number;
  status: Memory['status'];
  cover_asset_id: string;
  created_at: string;
  updated_at: string;
  asset_id: string;
  media_type: MemoryAsset['type'];
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  sort_order: number;
  asset_visibility: MemoryAsset['visibility'];
}

interface AssetDescriptorRow {
  asset_id: string;
  object_key: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  visibility: MemoryAsset['visibility'];
  status: Memory['status'];
}

interface ObjectKeyRow {
  object_key: string;
}

interface AssetOwnerRow {
  asset_id: string;
  memory_id: string;
}

interface AssetDeletionTargetRow {
  memory_id: string;
  object_key: string;
  cover_asset_id: string;
}

interface AssetOrderRow {
  id: string;
  sort_order: number;
}

export async function listMemories(env: Env, isOwner: boolean): Promise<Memory[]> {
  const accessClause = isOwner
    ? '1 = 1'
    : "m.status = 'published' AND a.visibility = 'public'";
  const result = await env.DB.prepare(`
    SELECT
      m.id AS memory_id,
      m.title,
      m.description,
      m.location,
      m.taken_at,
      m.category,
      m.visibility,
      m.is_featured,
      m.status,
      m.cover_asset_id,
      m.created_at,
      m.updated_at,
      a.id AS asset_id,
      a.media_type,
      a.original_filename,
      a.mime_type,
      a.size_bytes,
      a.sort_order,
      a.visibility AS asset_visibility
    FROM memories m
    INNER JOIN media_assets a ON a.memory_id = m.id
    WHERE ${accessClause}
    ORDER BY m.taken_at DESC, m.created_at DESC, a.sort_order ASC
  `).all<JoinedMemoryRow>();

  return aggregateMemories(result.results, isOwner);
}

export async function getMemory(env: Env, memoryId: string, isOwner: boolean): Promise<Memory | null> {
  const accessClause = isOwner
    ? '1 = 1'
    : "m.status = 'published' AND a.visibility = 'public'";
  const result = await env.DB.prepare(`
    SELECT
      m.id AS memory_id,
      m.title,
      m.description,
      m.location,
      m.taken_at,
      m.category,
      m.visibility,
      m.is_featured,
      m.status,
      m.cover_asset_id,
      m.created_at,
      m.updated_at,
      a.id AS asset_id,
      a.media_type,
      a.original_filename,
      a.mime_type,
      a.size_bytes,
      a.sort_order,
      a.visibility AS asset_visibility
    FROM memories m
    INNER JOIN media_assets a ON a.memory_id = m.id
    WHERE m.id = ? AND ${accessClause}
    ORDER BY a.sort_order ASC
  `)
    .bind(memoryId)
    .all<JoinedMemoryRow>();

  return aggregateMemories(result.results, isOwner)[0] ?? null;
}

export async function createMemory(
  request: Request,
  env: Env,
  owner: OwnerIdentity,
): Promise<Memory> {
  const input = validateCreateMemoryRequest(await request.json());
  for (const asset of input.assets) assertOwnedObjectKey(asset.objectKey, owner.userId);

  await verifyUploadedObjects(env, input);

  const memoryId = crypto.randomUUID();
  const assetIds = input.assets.map(() => crypto.randomUUID());
  const coverIndex = input.assets.findIndex((asset) => asset.objectKey === input.coverObjectKey);
  const coverAssetId = assetIds[coverIndex];
  if (!coverAssetId) throw new ValidationError('A valid cover asset is required.');

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`
      INSERT INTO memories (
        id, title, description, location, taken_at, category, visibility,
        is_featured, status, cover_asset_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      memoryId,
      input.title,
      input.description,
      input.location,
      input.date,
      input.category,
      'private',
      input.featured ? 1 : 0,
      input.status,
      coverAssetId,
      owner.userId,
    ),
  ];

  input.assets.forEach((asset, index) => {
    statements.push(
      env.DB.prepare(`
        INSERT INTO media_assets (
          id, memory_id, media_type, object_key, original_filename,
          mime_type, size_bytes, sort_order, visibility
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        assetIds[index],
        memoryId,
        asset.mediaType,
        asset.objectKey,
        asset.originalFilename,
        asset.mimeType,
        asset.sizeBytes,
        asset.sortOrder,
        asset.visibility,
      ),
    );
  });

  try {
    await env.DB.batch(statements);
  } catch (error) {
    await Promise.allSettled(input.assets.map((asset) => env.MEDIA.delete(asset.objectKey)));
    throw error;
  }

  const created = await getMemoryForOwner(env, memoryId);
  if (!created) throw new HttpError(500, 'The memory was saved but could not be reloaded.');
  return created;
}

export async function updateMemory(
  request: Request,
  env: Env,
  memoryId: string,
): Promise<Memory> {
  const input = (await request.json()) as UpdateMemoryRequest;
  const assignments: string[] = [];
  const values: unknown[] = [];

  if (input.title !== undefined) addTextUpdate(assignments, values, 'title', input.title, 120);
  if (input.location !== undefined) addTextUpdate(assignments, values, 'location', input.location, 160);
  if (input.description !== undefined) addTextUpdate(assignments, values, 'description', input.description, 600, true);
  if (input.date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ValidationError('Date must use YYYY-MM-DD format.');
    assignments.push('taken_at = ?');
    values.push(input.date);
  }
  if (input.category !== undefined) {
    if (!MEMORY_CATEGORIES.includes(input.category)) throw new ValidationError('Choose a valid memory category.');
    assignments.push('category = ?');
    values.push(input.category);
  }
  if (input.visibility !== undefined) {
    if (input.visibility !== 'public' && input.visibility !== 'private') {
      throw new ValidationError('Visibility must be public or private.');
    }
    assignments.push('visibility = ?');
    values.push(input.visibility);
  }
  if (input.status !== undefined) {
    if (input.status !== 'draft' && input.status !== 'published') {
      throw new ValidationError('Status must be draft or published.');
    }
    assignments.push('status = ?');
    values.push(input.status);
  }
  if (input.featured !== undefined) {
    assignments.push('is_featured = ?');
    values.push(input.featured ? 1 : 0);
  }
  if (input.coverAssetId !== undefined) {
    const cover = await env.DB.prepare(
      'SELECT id FROM media_assets WHERE id = ? AND memory_id = ? LIMIT 1',
    )
      .bind(input.coverAssetId, memoryId)
      .first<{ id: string }>();
    if (!cover) throw new ValidationError('The selected cover does not belong to this memory.');
    assignments.push('cover_asset_id = ?');
    values.push(input.coverAssetId);
  }

  if (assignments.length === 0) throw new ValidationError('No memory fields were provided.');
  assignments.push('updated_at = CURRENT_TIMESTAMP');
  const result = await env.DB.prepare(`UPDATE memories SET ${assignments.join(', ')} WHERE id = ?`)
    .bind(...values, memoryId)
    .run();
  if (!result.meta.changes) throw new HttpError(404, 'Memory not found.');

  const updated = await getMemoryForOwner(env, memoryId);
  if (!updated) throw new HttpError(404, 'Memory not found.');
  return updated;
}

export async function updateAssetVisibility(
  request: Request,
  env: Env,
  assetId: string,
): Promise<UpdateAssetVisibilityResponse> {
  const input = validateAssetVisibilityUpdate(await request.json());
  const asset = await env.DB.prepare(`
    SELECT id AS asset_id, memory_id
    FROM media_assets
    WHERE id = ?
    LIMIT 1
  `)
    .bind(assetId)
    .first<AssetOwnerRow>();

  if (!asset) throw new HttpError(404, 'Asset not found.');

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE media_assets
      SET visibility = ?
      WHERE id = ?
    `).bind(input.visibility, assetId),
    env.DB.prepare(`
      UPDATE memories
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(asset.memory_id),
  ]);

  return { assetId, visibility: input.visibility };
}

export async function deleteAsset(
  env: Env,
  assetId: string,
  ctx: ExecutionContext,
): Promise<DeleteAssetResponse> {
  const target = await env.DB.prepare(`
    SELECT
      a.memory_id,
      a.object_key,
      m.cover_asset_id
    FROM media_assets a
    INNER JOIN memories m ON m.id = a.memory_id
    WHERE a.id = ?
    LIMIT 1
  `)
    .bind(assetId)
    .first<AssetDeletionTargetRow>();

  if (!target) throw new HttpError(404, 'Asset not found.');

  const assetRows = await env.DB.prepare(`
    SELECT id, sort_order
    FROM media_assets
    WHERE memory_id = ?
    ORDER BY sort_order ASC
  `)
    .bind(target.memory_id)
    .all<AssetOrderRow>();

  const plan = planAssetDeletion(
    assetRows.results.map((asset) => ({ id: asset.id, sortOrder: asset.sort_order })),
    assetId,
    target.cover_asset_id,
  );

  if (plan.deleteMemory) {
    const result = await env.DB.prepare('DELETE FROM memories WHERE id = ?')
      .bind(target.memory_id)
      .run();
    if (!result.meta.changes) throw new HttpError(404, 'Memory not found.');

    ctx.waitUntil(
      Promise.allSettled([env.MEDIA.delete(target.object_key)]).then(() => undefined),
    );

    return {
      deletedAssetId: assetId,
      deletedMemory: true,
      memoryId: target.memory_id,
      replacementCoverAssetId: null,
    };
  }

  const statements: D1PreparedStatement[] = [];
  if (plan.replacementCoverAssetId) {
    statements.push(
      env.DB.prepare(`
        UPDATE memories
        SET cover_asset_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(plan.replacementCoverAssetId, target.memory_id),
    );
  } else {
    statements.push(
      env.DB.prepare(`
        UPDATE memories
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(target.memory_id),
    );
  }

  statements.push(
    env.DB.prepare('DELETE FROM media_assets WHERE id = ?').bind(assetId),
  );

  const results = await env.DB.batch(statements);
  const deleteResult = results[results.length - 1];
  if (!deleteResult?.meta.changes) throw new HttpError(404, 'Asset not found.');

  ctx.waitUntil(
    Promise.allSettled([env.MEDIA.delete(target.object_key)]).then(() => undefined),
  );

  return {
    deletedAssetId: assetId,
    deletedMemory: false,
    memoryId: target.memory_id,
    replacementCoverAssetId: plan.replacementCoverAssetId,
  };
}

export async function deleteMemory(
  env: Env,
  memoryId: string,
  ctx: ExecutionContext,
): Promise<Response> {
  const keys = await env.DB.prepare('SELECT object_key FROM media_assets WHERE memory_id = ?')
    .bind(memoryId)
    .all<ObjectKeyRow>();
  const result = await env.DB.prepare('DELETE FROM memories WHERE id = ?').bind(memoryId).run();
  if (!result.meta.changes) return notFound();
  ctx.waitUntil(Promise.allSettled(keys.results.map((row) => env.MEDIA.delete(row.object_key))).then(() => undefined));
  return noContent();
}

export async function serveAsset(
  request: Request,
  env: Env,
  assetId: string,
  download: boolean,
): Promise<Response> {
  const descriptor = await env.DB.prepare(`
    SELECT
      a.id AS asset_id,
      a.object_key,
      a.original_filename,
      a.mime_type,
      a.size_bytes,
      a.visibility,
      m.status
    FROM media_assets a
    INNER JOIN memories m ON m.id = a.memory_id
    WHERE a.id = ?
    LIMIT 1
  `)
    .bind(assetId)
    .first<AssetDescriptorRow>();

  if (!descriptor) return notFound();
  const publiclyVisible = descriptor.visibility === 'public' && descriptor.status === 'published';
  if (!publiclyVisible && !(await optionalOwner(request, env))) return notFound();

  if (request.method === 'HEAD') {
    const head = await env.MEDIA.head(descriptor.object_key);
    if (!head) return notFound();
    const headers = new Headers();
    head.writeHttpMetadata(headers);
    applyAssetHeaders(headers, descriptor, download, publiclyVisible);
    headers.set('content-length', String(head.size));
    headers.set('etag', head.httpEtag);
    return new Response(null, { status: 200, headers });
  }

  const object = await env.MEDIA.get(descriptor.object_key, {
    onlyIf: request.headers,
    range: request.headers,
  });
  if (!object) return notFound();
  if (!('body' in object)) return new Response(null, { status: 412 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  applyAssetHeaders(headers, descriptor, download, publiclyVisible);
  headers.set('etag', object.httpEtag);
  headers.set('accept-ranges', 'bytes');

  let status = 200;
  if (object.range) {
    const { offset, length } = normalizeR2Range(object.range, object.size);
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('content-length', String(length));
    status = 206;
  } else {
    headers.set('content-length', String(object.size));
  }

  return new Response(object.body, { status, headers });
}

function normalizeR2Range(range: R2Range, objectSize: number): { offset: number; length: number } {
  if ('suffix' in range) {
    const length = Math.min(range.suffix, objectSize);
    return { offset: objectSize - length, length };
  }
  const offset = range.offset ?? 0;
  const length = range.length ?? Math.max(0, objectSize - offset);
  return { offset, length };
}

function aggregateMemories(rows: JoinedMemoryRow[], isOwner: boolean): Memory[] {
  const memories = new Map<string, Memory>();
  for (const row of rows) {
    let memory = memories.get(row.memory_id);
    if (!memory) {
      memory = {
        id: row.memory_id,
        title: row.title,
        location: row.location,
        date: row.taken_at,
        description: row.description,
        category: row.category,
        visibility: isOwner ? row.visibility : 'public',
        featured: Boolean(row.is_featured),
        status: row.status,
        coverAssetId: row.cover_asset_id,
        assets: [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      memories.set(row.memory_id, memory);
    }
    memory.assets.push({
      id: row.asset_id,
      type: row.media_type,
      url: `/api/assets/${encodeURIComponent(row.asset_id)}`,
      downloadUrl: `/api/assets/${encodeURIComponent(row.asset_id)}/download`,
      filename: row.original_filename,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      sortOrder: row.sort_order,
      visibility: row.asset_visibility,
    });
  }

  const aggregated = [...memories.values()];
  if (!isOwner) {
    for (const memory of aggregated) {
      memory.coverAssetId = resolveVisibleCoverAssetId(memory.coverAssetId, memory.assets);
    }
  }
  return aggregated;
}

async function getMemoryForOwner(env: Env, memoryId: string): Promise<Memory | null> {
  const result = await env.DB.prepare(`
    SELECT
      m.id AS memory_id,
      m.title,
      m.description,
      m.location,
      m.taken_at,
      m.category,
      m.visibility,
      m.is_featured,
      m.status,
      m.cover_asset_id,
      m.created_at,
      m.updated_at,
      a.id AS asset_id,
      a.media_type,
      a.original_filename,
      a.mime_type,
      a.size_bytes,
      a.sort_order,
      a.visibility AS asset_visibility
    FROM memories m
    INNER JOIN media_assets a ON a.memory_id = m.id
    WHERE m.id = ?
    ORDER BY a.sort_order ASC
  `)
    .bind(memoryId)
    .all<JoinedMemoryRow>();
  return aggregateMemories(result.results, true)[0] ?? null;
}

async function verifyUploadedObjects(env: Env, input: CreateMemoryRequest): Promise<void> {
  await Promise.all(
    input.assets.map(async (asset) => {
      const object = await env.MEDIA.head(asset.objectKey);
      if (!object) throw new ValidationError(`${asset.originalFilename} was not found in storage.`);
      if (object.size !== asset.sizeBytes) {
        throw new ValidationError(`${asset.originalFilename} size does not match the uploaded object.`);
      }
      const storedType = object.httpMetadata?.contentType;
      if (storedType && storedType.toLowerCase() !== asset.mimeType.toLowerCase()) {
        throw new ValidationError(`${asset.originalFilename} content type does not match.`);
      }
    }),
  );
}

function applyAssetHeaders(
  headers: Headers,
  descriptor: AssetDescriptorRow,
  download: boolean,
  publiclyVisible: boolean,
): void {
  headers.set('content-type', descriptor.mime_type || 'application/octet-stream');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('cache-control', publiclyVisible ? 'public, max-age=3600' : 'private, no-store');
  const safeFilename = sanitizeDownloadFilename(descriptor.original_filename);
  headers.set(
    'content-disposition',
    `${download ? 'attachment' : 'inline'}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
  );
}

function addTextUpdate(
  assignments: string[],
  values: unknown[],
  column: string,
  value: unknown,
  maxLength: number,
  allowEmpty = false,
): void {
  if (typeof value !== 'string') throw new ValidationError(`${column} must be text.`);
  const normalized = value.trim();
  if (!allowEmpty && normalized.length === 0) throw new ValidationError(`${column} is required.`);
  if (normalized.length > maxLength) throw new ValidationError(`${column} is too long.`);
  assignments.push(`${column} = ?`);
  values.push(normalized);
}
