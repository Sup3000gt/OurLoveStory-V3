import type {
  MemoryCategory,
  MemoryStatus,
  UploadSession,
  UploadSessionFile,
  UploadSessionFileStatus,
  UploadSessionKind,
  UploadSessionStatus,
  UploadSessionSummary,
  Visibility,
} from '../../shared/contracts';
import type { Env } from '../env';

export interface UploadSessionRow {
  id: string;
  owner_id: string;
  session_kind: UploadSessionKind;
  memory_id: string | null;
  title: string | null;
  description: string;
  location: string | null;
  taken_at: string | null;
  category: MemoryCategory | null;
  is_featured: number;
  target_memory_status: MemoryStatus;
  expected_file_count: number;
  completed_file_count: number;
  reserved_sort_start: number | null;
  proposed_cover_session_file_id: string | null;
  session_status: UploadSessionStatus;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface UploadSessionFileRow {
  id: string;
  upload_session_id: string;
  resume_fingerprint: string;
  content_hash: string | null;
  hash_version: number;
  occurrence_index: number;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  original_sort_order: number;
  review_sort_order: number;
  target_visibility: Visibility;
  allow_duplicate: number;
  object_key: string | null;
  file_status: UploadSessionFileStatus;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface OwnedMemoryStats {
  memoryId: string;
  currentAssetCount: number;
  maxSortOrder: number;
}

export async function getOwnedSessionRow(
  env: Env,
  sessionId: string,
  ownerId: string,
): Promise<UploadSessionRow | null> {
  return env.DB.prepare(`
    SELECT *
    FROM upload_sessions
    WHERE id = ?
      AND owner_id = ?
    LIMIT 1
  `)
    .bind(sessionId, ownerId)
    .first<UploadSessionRow>();
}

export async function getOwnedSession(
  env: Env,
  sessionId: string,
  ownerId: string,
): Promise<UploadSession | null> {
  const row = await getOwnedSessionRow(
    env,
    sessionId,
    ownerId,
  );
  if (!row) return null;

  const files = await listSessionFiles(env, row.id);
  return mapUploadSession(row, files);
}

export async function listOwnedActiveSessions(
  env: Env,
  ownerId: string,
): Promise<UploadSessionSummary[]> {
  const result = await env.DB.prepare(`
    SELECT *
    FROM upload_sessions
    WHERE owner_id = ?
      AND session_status IN ('uploading', 'review')
    ORDER BY updated_at DESC, id DESC
  `)
    .bind(ownerId)
    .all<UploadSessionRow>();

  return result.results.map(mapUploadSessionSummary);
}

export async function listSessionFiles(
  env: Env,
  sessionId: string,
): Promise<UploadSessionFileRow[]> {
  const result = await env.DB.prepare(`
    SELECT *
    FROM upload_session_files
    WHERE upload_session_id = ?
    ORDER BY review_sort_order ASC, id ASC
  `)
    .bind(sessionId)
    .all<UploadSessionFileRow>();

  return result.results;
}

export async function getOwnedSessionFile(
  env: Env,
  sessionId: string,
  fileId: string,
  ownerId: string,
): Promise<UploadSessionFileRow | null> {
  return env.DB.prepare(`
    SELECT f.*
    FROM upload_session_files f
    INNER JOIN upload_sessions s
      ON s.id = f.upload_session_id
    WHERE s.id = ?
      AND s.owner_id = ?
      AND f.id = ?
    LIMIT 1
  `)
    .bind(sessionId, ownerId, fileId)
    .first<UploadSessionFileRow>();
}

export async function getOwnedMemoryStats(
  env: Env,
  memoryId: string,
  ownerId: string,
): Promise<OwnedMemoryStats | null> {
  const row = await env.DB.prepare(`
    SELECT
      m.id AS memory_id,
      COUNT(a.id) AS current_asset_count,
      COALESCE(MAX(a.sort_order), -1) AS max_sort_order
    FROM memories m
    LEFT JOIN media_assets a ON a.memory_id = m.id
    WHERE m.id = ?
      AND m.created_by = ?
    GROUP BY m.id
  `)
    .bind(memoryId, ownerId)
    .first<{
      memory_id: string;
      current_asset_count: number;
      max_sort_order: number;
    }>();

  return row
    ? {
        memoryId: row.memory_id,
        currentAssetCount: Number(row.current_asset_count),
        maxSortOrder: Number(row.max_sort_order),
      }
    : null;
}

export async function findExistingMemoryHashes(
  env: Env,
  memoryId: string,
  hashes: string[],
): Promise<Set<string>> {
  const found = new Set<string>();
  const unique = [...new Set(hashes)];

  for (let index = 0; index < unique.length; index += 90) {
    const chunk = unique.slice(index, index + 90);
    if (chunk.length === 0) continue;

    const placeholders = chunk.map(() => '?').join(', ');
    const result = await env.DB.prepare(`
      SELECT DISTINCT content_hash
      FROM media_assets
      WHERE memory_id = ?
        AND content_hash IN (${placeholders})
    `)
      .bind(memoryId, ...chunk)
      .all<{ content_hash: string }>();

    for (const row of result.results) {
      if (row.content_hash) found.add(row.content_hash);
    }
  }

  return found;
}

export function mapUploadSessionFile(
  row: UploadSessionFileRow,
): UploadSessionFile {
  return {
    id: row.id,
    resumeFingerprint: row.resume_fingerprint,
    contentHash: row.content_hash,
    occurrenceIndex: row.occurrence_index,
    filename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    originalSortOrder: row.original_sort_order,
    reviewSortOrder: row.review_sort_order,
    targetVisibility: row.target_visibility,
    allowDuplicate: Boolean(row.allow_duplicate),
    objectKey: row.object_key,
    status: row.file_status,
    lastError: row.last_error,
  };
}

export function mapUploadSession(
  row: UploadSessionRow,
  files: UploadSessionFileRow[],
): UploadSession {
  return {
    id: row.id,
    kind: row.session_kind,
    memoryId: row.memory_id,
    title: row.title,
    location: row.location,
    date: row.taken_at,
    category: row.category,
    description: row.description,
    featured: Boolean(row.is_featured),
    targetMemoryStatus: row.target_memory_status,
    expectedFileCount: row.expected_file_count,
    completedFileCount: row.completed_file_count,
    reservedSortStart: row.reserved_sort_start,
    proposedCoverSessionFileId:
      row.proposed_cover_session_file_id,
    status: row.session_status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    files: files.map(mapUploadSessionFile),
  };
}

export function mapUploadSessionSummary(
  row: UploadSessionRow,
): UploadSessionSummary {
  return {
    id: row.id,
    kind: row.session_kind,
    memoryId: row.memory_id,
    title: row.title,
    expectedFileCount: row.expected_file_count,
    completedFileCount: row.completed_file_count,
    status: row.session_status,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}
