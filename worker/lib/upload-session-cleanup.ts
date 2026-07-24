import type { Env } from '../env';
import {
  deleteSessionImageObjects,
} from './image-session-lifecycle';
import {
  listSessionFiles,
} from './upload-session-repository';
import {
  logUploadEvent,
} from './structured-log';

interface CleanupSessionRow {
  id: string;
  owner_id: string;
  memory_id: string | null;
  session_status:
    | 'uploading'
    | 'review'
    | 'abandoned';
}

export interface UploadSessionCleanupResult {
  scanned: number;
  cleaned: number;
  failed: number;
}

const CLEANUP_BATCH_SIZE = 25;

export async function cleanupExpiredUploadSessions(
  env: Env,
  options: {
    now?: Date;
    requestId?: string;
  } = {},
): Promise<UploadSessionCleanupResult> {
  const now =
    options.now ?? new Date();
  const requestId =
    options.requestId
    ?? `cleanup:${now.toISOString()}`;
  const result = await env.DB.prepare(`
    SELECT
      id,
      owner_id,
      memory_id,
      session_status
    FROM upload_sessions
    WHERE session_status = 'abandoned'
      OR (
        session_status IN ('uploading', 'review')
        AND expires_at <= ?
      )
    ORDER BY expires_at ASC, id ASC
    LIMIT ?
  `)
    .bind(
      now.toISOString(),
      CLEANUP_BATCH_SIZE,
    )
    .all<CleanupSessionRow>();

  let cleaned = 0;
  let failed = 0;

  for (const session of result.results) {
    try {
      if (
        session.session_status
        !== 'abandoned'
      ) {
        await env.DB.prepare(`
          UPDATE upload_sessions
          SET session_status = 'abandoned',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND session_status IN ('uploading', 'review')
        `)
          .bind(session.id)
          .run();
      }

      const files =
        await listSessionFiles(
          env,
          session.id,
        );
      await deleteSessionImageObjects(
        env,
        session.id,
        files.map((file) => ({
          id: file.id,
          objectKey:
            file.object_key,
        })),
      );
      await env.DB.prepare(`
        DELETE FROM upload_sessions
        WHERE id = ?
          AND session_status = 'abandoned'
      `)
        .bind(session.id)
        .run();
      cleaned += 1;
    } catch {
      failed += 1;
      logUploadEvent({
        level: 'error',
        requestId,
        ownerId: session.owner_id,
        memoryId: session.memory_id,
        sessionId: session.id,
        stage: 'cleanup',
        errorCode:
          'SESSION_CLEANUP_FAILED',
      });
    }
  }

  logUploadEvent({
    level:
      failed > 0
        ? 'warn'
        : 'info',
    requestId,
    stage: 'cleanup',
    itemCount: cleaned,
    errorCode:
      failed > 0
        ? `FAILED_${failed}`
        : undefined,
  });

  return {
    scanned: result.results.length,
    cleaned,
    failed,
  };
}
