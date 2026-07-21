import type {
  AppendPhotoSessionRequest,
  AuthorizeSessionBatchResponse,
  CheckUploadSessionDuplicatesResponse,
  CreateUploadSessionRequest,
  Memory,
  RecordSessionFailureRequest,
  RecordSessionUploadRequest,
  UpdateSessionFileRequest,
  UpdateSessionReviewRequest,
  UploadSession,
  UploadSessionFileStatus,
  UploadSessionMatchRequest,
  UploadSessionMatchResponse,
  UploadSessionSummary,
} from '../../shared/contracts';
import {
  CONTENT_HASH_VERSION,
  UPLOAD_SESSION_TTL_DAYS,
} from '../../shared/upload-constants';
import type { Env, OwnerIdentity } from '../env';
import { getMemory } from './memories';
import {
  findExistingMemoryHashes,
  getOwnedMemoryStats,
  getOwnedSession,
  getOwnedSessionFile,
  getOwnedSessionRow,
  listOwnedActiveSessions,
  listSessionFiles,
  mapUploadSession,
  type UploadSessionFileRow,
  type UploadSessionRow,
} from './upload-session-repository';
import {
  calculateSessionProgress,
  ensureMemoryCapacity,
  nextSessionStatus,
  planInitialSessionFiles,
} from './upload-session-state';
import { HttpError } from './responses';
import { logUploadEvent } from './structured-log';
import { authorizeUploadFile } from './uploads';
import {
  assertOwnedObjectKey,
  safeObjectExtension,
  ValidationError,
} from './validation';

interface InitialFilePlan {
  id: string;
  status: 'pending' | 'skipped';
  duplicate: boolean;
}

export async function createUploadSession(
  env: Env,
  owner: OwnerIdentity,
  input: CreateUploadSessionRequest,
  requestId: string,
): Promise<UploadSession> {
  const startedAt = performance.now();
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now()
      + UPLOAD_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  let memoryId: string | null = null;
  let reservedSortStart: number | null = 0;
  let existingHashes = new Set<string>();

  if (input.sessionKind === 'append') {
    memoryId = input.memoryId;
    const stats = await getOwnedMemoryStats(
      env,
      memoryId,
      owner.userId,
    );
    if (!stats) {
      throw new HttpError(404, 'Memory not found.');
    }

    reservedSortStart = stats.maxSortOrder + 1;
    existingHashes = await findExistingMemoryHashes(
      env,
      memoryId,
      input.files.map((file) => file.contentHash),
    );
  }

  const statusPlans = planInitialSessionFiles(
    input.files,
    existingHashes,
  );
  const acceptedCount = statusPlans.filter(
    (plan) => plan.status === 'pending',
  ).length;

  if (input.sessionKind === 'append') {
    const stats = await getOwnedMemoryStats(
      env,
      input.memoryId,
      owner.userId,
    );
    if (!stats) {
      throw new HttpError(404, 'Memory not found.');
    }
    ensureMemoryCapacity(
      stats.currentAssetCount,
      acceptedCount,
    );
  }

  const filePlans: InitialFilePlan[] =
    statusPlans.map((plan) => ({
      id: crypto.randomUUID(),
      ...plan,
    }));

  const initialStatuses = filePlans.map(
    (plan) => plan.status,
  );
  const progress = calculateSessionProgress(
    initialStatuses,
  );
  const sessionStatus = nextSessionStatus(
    initialStatuses,
  );

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`
      INSERT INTO upload_sessions (
        id,
        owner_id,
        session_kind,
        memory_id,
        title,
        description,
        location,
        taken_at,
        category,
        is_featured,
        target_memory_status,
        expected_file_count,
        completed_file_count,
        reserved_sort_start,
        proposed_cover_session_file_id,
        session_status,
        expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `).bind(
      sessionId,
      owner.userId,
      input.sessionKind,
      memoryId,
      input.sessionKind === 'create' ? input.title : null,
      input.sessionKind === 'create'
        ? input.description
        : '',
      input.sessionKind === 'create'
        ? input.location
        : null,
      input.sessionKind === 'create'
        ? input.date
        : null,
      input.sessionKind === 'create'
        ? input.category
        : null,
      input.sessionKind === 'create'
        && input.featured
        ? 1
        : 0,
      input.sessionKind === 'create'
        ? input.targetMemoryStatus
        : 'published',
      input.files.length,
      progress.completedFileCount,
      reservedSortStart,
      sessionStatus,
      expiresAt,
    ),
  ];

  input.files.forEach((file, index) => {
    const plan = filePlans[index]!;
    statements.push(
      env.DB.prepare(`
        INSERT INTO upload_session_files (
          id,
          upload_session_id,
          resume_fingerprint,
          content_hash,
          hash_version,
          occurrence_index,
          original_filename,
          mime_type,
          size_bytes,
          original_sort_order,
          review_sort_order,
          target_visibility,
          allow_duplicate,
          file_status,
          last_error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `).bind(
        plan.id,
        sessionId,
        file.resumeFingerprint,
        file.contentHash,
        CONTENT_HASH_VERSION,
        file.occurrenceIndex,
        file.filename,
        file.mimeType,
        file.sizeBytes,
        file.originalSortOrder,
        file.originalSortOrder,
        file.targetVisibility,
        plan.status,
        plan.duplicate ? 'duplicate' : null,
      ),
    );
  });

  try {
    await env.DB.batch(statements);
  } catch (error) {
    if (
      input.sessionKind === 'append'
      && isActiveAppendConstraintError(error)
    ) {
      throw new HttpError(
        409,
        'This album already has an unfinished photo addition.',
      );
    }
    throw error;
  }

  logUploadEvent({
    level: 'info',
    requestId,
    ownerId: owner.userId,
    memoryId,
    sessionId,
    stage: 'session.create',
    itemCount: input.files.length,
    durationMs: performance.now() - startedAt,
  });

  return requireOwnedSession(
    env,
    sessionId,
    owner.userId,
  );
}

export async function listUploadSessions(
  env: Env,
  owner: OwnerIdentity,
): Promise<UploadSessionSummary[]> {
  return listOwnedActiveSessions(env, owner.userId);
}

export async function readUploadSession(
  env: Env,
  owner: OwnerIdentity,
  sessionId: string,
): Promise<UploadSession> {
  return requireOwnedSession(
    env,
    sessionId,
    owner.userId,
  );
}

export async function checkUploadSessionDuplicates(
  env: Env,
  owner: OwnerIdentity,
  sessionId: string,
): Promise<CheckUploadSessionDuplicatesResponse> {
  const session = await requireOwnedSession(
    env,
    sessionId,
    owner.userId,
  );

  return {
    duplicates: session.files
      .filter((file) => file.lastError === 'duplicate')
      .map((file) => ({
        sessionFileId: file.id,
        contentHash: file.contentHash!,
        allowDuplicate: file.allowDuplicate,
        skipped: file.status === 'skipped',
      })),
  };
}

export async function matchUploadSessionFiles(
  env: Env,
  owner: OwnerIdentity,
  sessionId: string,
  input: UploadSessionMatchRequest,
): Promise<UploadSessionMatchResponse> {
  const session = await requireOwnedSession(
    env,
    sessionId,
    owner.userId,
  );

  const unmatchedSessionIds = new Set(
    session.files.map((file) => file.id),
  );
  const matches: UploadSessionMatchResponse['matches'] = [];
  const unmatchedLocalIds: string[] = [];

  for (const local of input.files) {
    const match = session.files.find(
      (file) =>
        unmatchedSessionIds.has(file.id)
        && file.resumeFingerprint
          === local.resumeFingerprint
        && file.occurrenceIndex
          === local.occurrenceIndex
        && file.filename === local.filename
        && file.sizeBytes === local.sizeBytes,
    );

    if (!match) {
      unmatchedLocalIds.push(local.localId);
      continue;
    }

    unmatchedSessionIds.delete(match.id);
    matches.push({
      localId: local.localId,
      sessionFileId: match.id,
      status: match.status,
    });
  }

  return {
    matches,
    missingSessionFileIds: [...unmatchedSessionIds],
    unmatchedLocalIds,
  };
}

export async function authorizeSessionBatch(
  env: Env,
  owner: OwnerIdentity,
  sessionId: string,
  sessionFileIds: string[],
  requestId: string,
): Promise<AuthorizeSessionBatchResponse> {
  const session = await requireOwnedSession(
    env,
    sessionId,
    owner.userId,
  );
  if (
    session.status !== 'uploading'
    && session.status !== 'review'
  ) {
    throw new HttpError(
      409,
      'This upload Session is not accepting photos.',
    );
  }

  const rows = await listSessionFiles(env, sessionId);
  const rowById = new Map(
    rows.map((row) => [row.id, row]),
  );
  const uploads: AuthorizeSessionBatchResponse['uploads'] = [];
  const statements: D1PreparedStatement[] = [];

  for (const sessionFileId of sessionFileIds) {
    const file = rowById.get(sessionFileId);
    if (!file) {
      throw new HttpError(
        404,
        'Session photo not found.',
      );
    }

    if (
      file.file_status === 'uploaded'
      || file.file_status === 'skipped'
    ) {
      continue;
    }

    if (
      file.file_status !== 'pending'
      && file.file_status !== 'failed'
      && file.file_status !== 'authorized'
    ) {
      throw new HttpError(
        409,
        `${file.original_filename} is not ready for authorization.`,
      );
    }

    const extension = safeObjectExtension(
      file.original_filename,
      file.mime_type,
    );
    const objectKey = file.object_key
      ?? `originals/${owner.userId}/${sessionId}/${file.id}.${extension}`;

    const upload = await authorizeUploadFile(
      env,
      owner,
      {
        filename: file.original_filename,
        mimeType: file.mime_type,
        sizeBytes: file.size_bytes,
      },
      objectKey,
    );

    uploads.push({
      ...upload,
      sessionFileId: file.id,
    });

    statements.push(
      env.DB.prepare(`
        UPDATE upload_session_files
        SET file_status = 'authorized',
            object_key = ?,
            last_error = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND upload_session_id = ?
      `).bind(objectKey, file.id, sessionId),
    );
  }

  if (statements.length > 0) {
    await env.DB.batch(statements);
  }

  logUploadEvent({
    level: 'info',
    requestId,
    ownerId: owner.userId,
    memoryId: session.memoryId,
    sessionId,
    stage: 'authorize',
    itemCount: uploads.length,
  });

  return { uploads };
}

export async function recordSessionUpload(
  env: Env,
  owner: OwnerIdentity,
  sessionId: string,
  input: RecordSessionUploadRequest,
  requestId: string,
): Promise<UploadSession> {
  await requireOwnedSession(
    env,
    sessionId,
    owner.userId,
  );
  const file = await getOwnedSessionFile(
    env,
    sessionId,
    input.sessionFileId,
    owner.userId,
  );
  if (!file) {
    throw new HttpError(404, 'Session photo not found.');
  }
  if (file.file_status === 'skipped') {
    throw new HttpError(
      409,
      'A skipped photo cannot be recorded as uploaded.',
    );
  }

  await verifySessionObject(
    env,
    owner.userId,
    sessionId,
    file,
    input.objectKey,
  );

  await env.DB.prepare(`
    UPDATE upload_session_files
    SET file_status = 'uploaded',
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND upload_session_id = ?
  `)
    .bind(file.id, sessionId)
    .run();

  const session = await recomputeSessionProgress(
    env,
    sessionId,
    owner.userId,
  );

  logUploadEvent({
    level: 'info',
    requestId,
    ownerId: owner.userId,
    memoryId: session.memoryId,
    sessionId,
    sessionFileId: file.id,
    stage: 'record.uploaded',
  });

  return session;
}

export async function recordSessionFailure(
  env: Env,
  owner: OwnerIdentity,
  sessionId: string,
  input: RecordSessionFailureRequest,
  requestId: string,
): Promise<UploadSession> {
  const file = await getOwnedSessionFile(
    env,
    sessionId,
    input.sessionFileId,
    owner.userId,
  );
  if (!file) {
    throw new HttpError(404, 'Session photo not found.');
  }

  if (
    file.file_status !== 'uploaded'
    && file.file_status !== 'skipped'
  ) {
    await env.DB.prepare(`
      UPDATE upload_session_files
      SET file_status = 'failed',
          last_error = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND upload_session_id = ?
    `)
      .bind(input.errorCode, file.id, sessionId)
      .run();
  }

  const session = await recomputeSessionProgress(
    env,
    sessionId,
    owner.userId,
  );

  logUploadEvent({
    level: 'warn',
    requestId,
    ownerId: owner.userId,
    memoryId: session.memoryId,
    sessionId,
    sessionFileId: file.id,
    stage: 'record.failed',
    errorCode: input.errorCode,
  });

  return session;
}

export async function updateSessionFile(
  env: Env,
  owner: OwnerIdentity,
  sessionId: string,
  fileId: string,
  input: UpdateSessionFileRequest,
): Promise<UploadSession> {
  const session = await requireOwnedSession(
    env,
    sessionId,
    owner.userId,
  );
  if (
    session.status !== 'uploading'
    && session.status !== 'review'
  ) {
    throw new HttpError(
      409,
      'This upload Session can no longer be changed.',
    );
  }

  const file = await getOwnedSessionFile(
    env,
    sessionId,
    fileId,
    owner.userId,
  );
  if (!file) {
    throw new HttpError(404, 'Session photo not found.');
  }

  const assignments: string[] = [];
  const values: unknown[] = [];

  if (input.targetVisibility !== undefined) {
    assignments.push('target_visibility = ?');
    values.push(input.targetVisibility);
  }
  if (input.reviewSortOrder !== undefined) {
    assignments.push('review_sort_order = ?');
    values.push(input.reviewSortOrder);
  }
  if (input.allowDuplicate !== undefined) {
    assignments.push('allow_duplicate = ?');
    values.push(input.allowDuplicate ? 1 : 0);
  }

  if (input.skipped !== undefined) {
    if (input.skipped) {
      assignments.push("file_status = 'skipped'");
    } else if (file.file_status === 'skipped') {
      const duplicateStillBlocked =
        file.last_error === 'duplicate'
        && input.allowDuplicate !== true;

      if (!duplicateStillBlocked) {
        const restoredStatus = file.object_key
          && await env.MEDIA.head(file.object_key)
          ? 'uploaded'
          : 'pending';
        assignments.push('file_status = ?');
        values.push(restoredStatus);
        assignments.push('last_error = NULL');
      }
    }
  }

  if (assignments.length === 0) {
    return session;
  }

  assignments.push('updated_at = CURRENT_TIMESTAMP');

  await env.DB.prepare(`
    UPDATE upload_session_files
    SET ${assignments.join(', ')}
    WHERE id = ?
      AND upload_session_id = ?
  `)
    .bind(...values, fileId, sessionId)
    .run();

  return recomputeSessionProgress(
    env,
    sessionId,
    owner.userId,
  );
}

export async function updateSessionReview(
  env: Env,
  owner: OwnerIdentity,
  sessionId: string,
  input: UpdateSessionReviewRequest,
): Promise<UploadSession> {
  const sessionRow = await requireOwnedSessionRow(
    env,
    sessionId,
    owner.userId,
  );
  if (sessionRow.session_status !== 'review') {
    throw new HttpError(
      409,
      'Upload all accepted photos before reviewing them.',
    );
  }

  const rows = await listSessionFiles(env, sessionId);
  const rowById = new Map(
    rows.map((row) => [row.id, row]),
  );
  if (input.files.length !== rows.length) {
    throw new ValidationError(
      'The review must include every Session photo.',
    );
  }

  const statements: D1PreparedStatement[] = [];
  let proposedCoverValid =
    input.proposedCoverSessionFileId === null;

  for (const update of input.files) {
    const row = rowById.get(update.sessionFileId);
    if (!row) {
      throw new HttpError(
        404,
        'A reviewed Session photo was not found.',
      );
    }

    let nextStatus: UploadSessionFileStatus =
      row.file_status;
    let lastError = row.last_error;

    if (update.skipped) {
      nextStatus = 'skipped';
    } else if (row.file_status === 'skipped') {
      const duplicateStillBlocked =
        row.last_error === 'duplicate'
        && !update.allowDuplicate;

      if (!duplicateStillBlocked) {
        nextStatus = row.object_key
          && await env.MEDIA.head(row.object_key)
          ? 'uploaded'
          : 'pending';
        lastError = null;
      }
    }

    if (
      input.proposedCoverSessionFileId === row.id
      && !update.skipped
      && nextStatus === 'uploaded'
    ) {
      proposedCoverValid = true;
    }

    statements.push(
      env.DB.prepare(`
        UPDATE upload_session_files
        SET review_sort_order = ?,
            target_visibility = ?,
            allow_duplicate = ?,
            file_status = ?,
            last_error = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND upload_session_id = ?
      `).bind(
        update.reviewSortOrder,
        update.targetVisibility,
        update.allowDuplicate ? 1 : 0,
        nextStatus,
        lastError,
        row.id,
        sessionId,
      ),
    );
  }

  if (!proposedCoverValid) {
    throw new ValidationError(
      'The proposed cover must be an uploaded, included Session photo.',
    );
  }

  statements.push(
    env.DB.prepare(`
      UPDATE upload_sessions
      SET proposed_cover_session_file_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND owner_id = ?
    `).bind(
      input.proposedCoverSessionFileId,
      sessionId,
      owner.userId,
    ),
  );

  await env.DB.batch(statements);

  return recomputeSessionProgress(
    env,
    sessionId,
    owner.userId,
  );
}

export async function confirmUploadSession(
  env: Env,
  owner: OwnerIdentity,
  sessionId: string,
  requestId: string,
): Promise<Memory> {
  const sessionRow = await requireOwnedSessionRow(
    env,
    sessionId,
    owner.userId,
  );

  if (sessionRow.session_status === 'completed') {
    if (!sessionRow.memory_id) {
      throw new HttpError(
        500,
        'The completed Session is missing its Memory.',
      );
    }
    const existing = await getMemory(
      env,
      sessionRow.memory_id,
      true,
    );
    if (!existing) {
      throw new HttpError(404, 'Memory not found.');
    }
    return existing;
  }

  if (sessionRow.session_status !== 'review') {
    throw new HttpError(
      409,
      'There are still photos waiting to upload.',
    );
  }

  const files = await listSessionFiles(
    env,
    sessionId,
  );
  if (
    files.some(
      (file) =>
        file.file_status !== 'uploaded'
        && file.file_status !== 'skipped',
    )
  ) {
    throw new HttpError(
      409,
      'There are still photos waiting to upload.',
    );
  }

  const accepted = files
    .filter((file) => file.file_status === 'uploaded')
    .sort(compareReviewOrder);

  if (accepted.length === 0) {
    throw new HttpError(
      409,
      'Include at least one uploaded photo before confirmation.',
    );
  }

  await mapWithConcurrency(
    accepted,
    4,
    async (file) => {
      if (!file.object_key) {
        throw new HttpError(
          409,
          `${file.original_filename} is missing its storage key.`,
        );
      }
      await verifySessionObject(
        env,
        owner.userId,
        sessionId,
        file,
        file.object_key,
      );
    },
  );

  const memory = sessionRow.session_kind === 'create'
    ? await confirmCreateSession(
        env,
        owner,
        sessionRow,
        accepted,
      )
    : await confirmAppendSession(
        env,
        owner,
        sessionRow,
        accepted,
      );

  logUploadEvent({
    level: 'info',
    requestId,
    ownerId: owner.userId,
    memoryId: memory.id,
    sessionId,
    stage: 'confirm',
    itemCount: accepted.length,
  });

  return memory;
}

export async function abandonUploadSession(
  env: Env,
  owner: OwnerIdentity,
  sessionId: string,
  requestId: string,
): Promise<void> {
  const session = await requireOwnedSession(
    env,
    sessionId,
    owner.userId,
  );
  if (session.status === 'completed') {
    throw new HttpError(
      409,
      'Completed photo additions cannot be abandoned.',
    );
  }

  const keys = session.files
    .map((file) => file.objectKey)
    .filter((key): key is string => Boolean(key));

  await env.DB.prepare(`
    UPDATE upload_sessions
    SET session_status = 'abandoned',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND owner_id = ?
  `)
    .bind(sessionId, owner.userId)
    .run();

  try {
    if (keys.length > 0) {
      await env.MEDIA.delete(keys);
    }
    await env.DB.prepare(`
      DELETE FROM upload_sessions
      WHERE id = ?
        AND owner_id = ?
        AND session_status = 'abandoned'
    `)
      .bind(sessionId, owner.userId)
      .run();
  } catch {
    logUploadEvent({
      level: 'error',
      requestId,
      ownerId: owner.userId,
      memoryId: session.memoryId,
      sessionId,
      stage: 'abandon',
      errorCode: 'R2_DELETE_FAILED',
    });
    throw new HttpError(
      503,
      'The photo addition was marked abandoned and will be cleaned up later.',
    );
  }

  logUploadEvent({
    level: 'info',
    requestId,
    ownerId: owner.userId,
    memoryId: session.memoryId,
    sessionId,
    stage: 'abandon',
    itemCount: keys.length,
  });
}

async function confirmCreateSession(
  env: Env,
  owner: OwnerIdentity,
  session: UploadSessionRow,
  accepted: UploadSessionFileRow[],
): Promise<Memory> {
  if (
    !session.title
    || !session.location
    || !session.taken_at
    || !session.category
  ) {
    throw new HttpError(
      500,
      'The Create Session is missing Memory metadata.',
    );
  }

  const memoryId = crypto.randomUUID();
  const assetIds = new Map(
    accepted.map((file) => [
      file.id,
      crypto.randomUUID(),
    ]),
  );
  const coverSessionFileId =
    session.proposed_cover_session_file_id
    ?? accepted[0]!.id;
  const coverAssetId = assetIds.get(
    coverSessionFileId,
  );

  if (!coverAssetId) {
    throw new ValidationError(
      'Choose a valid cover photo.',
    );
  }

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`
      INSERT INTO memories (
        id,
        title,
        description,
        location,
        taken_at,
        category,
        visibility,
        is_featured,
        status,
        cover_asset_id,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'private', ?, ?, ?, ?)
    `).bind(
      memoryId,
      session.title,
      session.description,
      session.location,
      session.taken_at,
      session.category,
      session.is_featured,
      session.target_memory_status,
      coverAssetId,
      owner.userId,
    ),
  ];

  accepted.forEach((file, index) => {
    statements.push(
      createAssetInsert(
        env,
        assetIds.get(file.id)!,
        memoryId,
        file,
        index,
      ),
    );
  });

  statements.push(
    env.DB.prepare(`
      UPDATE upload_sessions
      SET memory_id = ?,
          session_status = 'completed',
          completed_file_count = expected_file_count,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND owner_id = ?
        AND session_status = 'review'
    `).bind(memoryId, session.id, owner.userId),
  );

  await env.DB.batch(statements);

  const memory = await getMemory(env, memoryId, true);
  if (!memory) {
    throw new HttpError(
      500,
      'The Memory was confirmed but could not be reloaded.',
    );
  }
  return memory;
}

async function confirmAppendSession(
  env: Env,
  owner: OwnerIdentity,
  session: UploadSessionRow,
  accepted: UploadSessionFileRow[],
): Promise<Memory> {
  if (!session.memory_id) {
    throw new HttpError(
      500,
      'The Append Session is missing its Memory.',
    );
  }

  const stats = await getOwnedMemoryStats(
    env,
    session.memory_id,
    owner.userId,
  );
  if (!stats) {
    throw new HttpError(404, 'Memory not found.');
  }

  ensureMemoryCapacity(
    stats.currentAssetCount,
    accepted.length,
  );
  const firstSortOrder = stats.maxSortOrder + 1;
  const assetIds = new Map(
    accepted.map((file) => [
      file.id,
      crypto.randomUUID(),
    ]),
  );

  const statements: D1PreparedStatement[] = [];
  accepted.forEach((file, index) => {
    statements.push(
      createAssetInsert(
        env,
        assetIds.get(file.id)!,
        session.memory_id!,
        file,
        firstSortOrder + index,
      ),
    );
  });

  const proposedCoverAssetId =
    session.proposed_cover_session_file_id
      ? assetIds.get(
          session.proposed_cover_session_file_id,
        )
      : undefined;

  if (
    session.proposed_cover_session_file_id
    && !proposedCoverAssetId
  ) {
    throw new ValidationError(
      'The proposed cover must be included in this photo addition.',
    );
  }

  statements.push(
    proposedCoverAssetId
      ? env.DB.prepare(`
          UPDATE memories
          SET cover_asset_id = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND created_by = ?
        `).bind(
          proposedCoverAssetId,
          session.memory_id,
          owner.userId,
        )
      : env.DB.prepare(`
          UPDATE memories
          SET updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND created_by = ?
        `).bind(
          session.memory_id,
          owner.userId,
        ),
  );

  statements.push(
    env.DB.prepare(`
      UPDATE upload_sessions
      SET session_status = 'completed',
          completed_file_count = expected_file_count,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND owner_id = ?
        AND session_status = 'review'
    `).bind(session.id, owner.userId),
  );

  await env.DB.batch(statements);

  const memory = await getMemory(
    env,
    session.memory_id,
    true,
  );
  if (!memory) {
    throw new HttpError(
      500,
      'The Memory was updated but could not be reloaded.',
    );
  }
  return memory;
}

function createAssetInsert(
  env: Env,
  assetId: string,
  memoryId: string,
  file: UploadSessionFileRow,
  sortOrder: number,
): D1PreparedStatement {
  if (!file.object_key) {
    throw new HttpError(
      409,
      `${file.original_filename} is missing its storage key.`,
    );
  }

  return env.DB.prepare(`
    INSERT INTO media_assets (
      id,
      memory_id,
      media_type,
      object_key,
      original_filename,
      mime_type,
      size_bytes,
      sort_order,
      visibility,
      content_hash,
      hash_version
    ) VALUES (?, ?, 'image', ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    assetId,
    memoryId,
    file.object_key,
    file.original_filename,
    file.mime_type,
    file.size_bytes,
    sortOrder,
    file.target_visibility,
    file.content_hash,
    file.hash_version,
  );
}

async function recomputeSessionProgress(
  env: Env,
  sessionId: string,
  ownerId: string,
): Promise<UploadSession> {
  const files = await listSessionFiles(
    env,
    sessionId,
  );
  const statuses = files.map(
    (file) => file.file_status,
  );
  const progress = calculateSessionProgress(
    statuses,
  );
  const status = nextSessionStatus(statuses);

  await env.DB.prepare(`
    UPDATE upload_sessions
    SET completed_file_count = ?,
        session_status = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND owner_id = ?
      AND session_status IN ('uploading', 'review')
  `)
    .bind(
      progress.completedFileCount,
      status,
      sessionId,
      ownerId,
    )
    .run();

  return requireOwnedSession(
    env,
    sessionId,
    ownerId,
  );
}

async function verifySessionObject(
  env: Env,
  ownerId: string,
  sessionId: string,
  file: UploadSessionFileRow,
  objectKey: string,
): Promise<void> {
  if (
    !file.object_key
    || file.object_key !== objectKey
  ) {
    throw new ValidationError(
      'Uploaded object key does not match authorization.',
    );
  }

  assertOwnedObjectKey(objectKey, ownerId);
  const expectedPrefix =
    `originals/${ownerId}/${sessionId}/`;
  if (!objectKey.startsWith(expectedPrefix)) {
    throw new ValidationError(
      'The uploaded object does not belong to this Session.',
    );
  }

  const object = await env.MEDIA.head(objectKey);
  if (!object) {
    throw new HttpError(
      409,
      'The uploaded photo was not found.',
    );
  }
  if (object.size !== file.size_bytes) {
    throw new HttpError(
      409,
      'The uploaded photo size does not match.',
    );
  }

  const contentType =
    object.httpMetadata?.contentType?.toLowerCase();
  if (
    contentType
    && contentType !== file.mime_type.toLowerCase()
  ) {
    throw new HttpError(
      409,
      'The uploaded photo type does not match.',
    );
  }
}

async function requireOwnedSession(
  env: Env,
  sessionId: string,
  ownerId: string,
): Promise<UploadSession> {
  const session = await getOwnedSession(
    env,
    sessionId,
    ownerId,
  );
  if (!session) {
    throw new HttpError(
      404,
      'Upload Session not found.',
    );
  }
  return session;
}

async function requireOwnedSessionRow(
  env: Env,
  sessionId: string,
  ownerId: string,
): Promise<UploadSessionRow> {
  const session = await getOwnedSessionRow(
    env,
    sessionId,
    ownerId,
  );
  if (!session) {
    throw new HttpError(
      404,
      'Upload Session not found.',
    );
  }
  return session;
}

function compareReviewOrder(
  left: UploadSessionFileRow,
  right: UploadSessionFileRow,
): number {
  return (
    left.review_sort_order - right.review_sort_order
    || left.id.localeCompare(right.id)
  );
}

function isActiveAppendConstraintError(
  error: unknown,
): boolean {
  return (
    error instanceof Error
    && (
      error.message.includes(
        'idx_one_active_append_session_per_memory',
      )
      || error.message.includes(
        'UNIQUE constraint failed: upload_sessions.memory_id',
      )
    )
  );
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const count = Math.min(
    concurrency,
    items.length,
  );

  await Promise.all(
    Array.from({ length: count }, async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        const item = items[index];
        if (item === undefined) return;
        await worker(item);
      }
    }),
  );
}