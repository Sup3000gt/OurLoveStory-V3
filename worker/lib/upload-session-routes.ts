import type { OwnerIdentity, Env } from '../env';
import {
  abandonUploadSession,
  authorizeSessionBatch,
  checkUploadSessionDuplicates,
  confirmUploadSession,
  createUploadSession,
  listUploadSessions,
  matchUploadSessionFiles,
  readUploadSession,
  recordSessionFailure,
  recordSessionUpload,
  updateSessionFile,
  updateSessionReview,
} from './upload-session-service';
import {
  validateAuthorizeSessionBatchRequest,
  validateCreateUploadSessionRequest,
  validateMatchUploadSessionRequest,
  validateRecordSessionFailureRequest,
  validateRecordSessionUploadRequest,
  validateUpdateSessionFileRequest,
  validateUpdateSessionReviewRequest,
} from './upload-session-validation';
import {
  json,
  methodNotAllowed,
  noContent,
} from './responses';

export type UploadSessionRoute =
  | { action: 'collection' }
  | { action: 'session'; sessionId: string }
  | { action: 'check-duplicates'; sessionId: string }
  | { action: 'match'; sessionId: string }
  | { action: 'authorize-batch'; sessionId: string }
  | { action: 'record-uploaded'; sessionId: string }
  | { action: 'record-failed'; sessionId: string }
  | { action: 'file'; sessionId: string; fileId: string }
  | { action: 'review'; sessionId: string }
  | { action: 'confirm'; sessionId: string };

const PREFIX = '/api/upload-sessions';

export function matchUploadSessionRoute(
  pathname: string,
): UploadSessionRoute | null {
  if (pathname === PREFIX) {
    return { action: 'collection' };
  }
  if (!pathname.startsWith(`${PREFIX}/`)) {
    return null;
  }

  const segments = pathname
    .slice(PREFIX.length + 1)
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);

  if (segments.length === 1) {
    return {
      action: 'session',
      sessionId: segments[0]!,
    };
  }

  if (segments.length === 2) {
    const [sessionId, action] = segments;
    if (
      action === 'check-duplicates'
      || action === 'match'
      || action === 'authorize-batch'
      || action === 'record-uploaded'
      || action === 'record-failed'
      || action === 'review'
      || action === 'confirm'
    ) {
      return { action, sessionId: sessionId! };
    }
  }

  if (
    segments.length === 3
    && segments[1] === 'files'
  ) {
    return {
      action: 'file',
      sessionId: segments[0]!,
      fileId: segments[2]!,
    };
  }

  return null;
}

export async function handleUploadSessionRoute(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  owner: OwnerIdentity,
  route: UploadSessionRoute,
  requestId: string,
): Promise<Response> {
  switch (route.action) {
    case 'collection':
      if (request.method === 'GET') {
        return json({
          sessions: await listUploadSessions(
            env,
            owner,
          ),
        });
      }
      if (request.method === 'POST') {
        const input =
          validateCreateUploadSessionRequest(
            await request.json(),
          );
        return json(
          await createUploadSession(
            env,
            owner,
            input,
            requestId,
          ),
          { status: 201 },
        );
      }
      return methodNotAllowed(['GET', 'POST']);

    case 'session':
      if (request.method === 'GET') {
        return json(
          await readUploadSession(
            env,
            owner,
            route.sessionId,
          ),
        );
      }
      if (request.method === 'DELETE') {
        await abandonUploadSession(
          env,
          owner,
          route.sessionId,
          requestId,
        );
        return noContent();
      }
      return methodNotAllowed(['GET', 'DELETE']);

    case 'check-duplicates':
      if (request.method !== 'POST') {
        return methodNotAllowed(['POST']);
      }
      return json(
        await checkUploadSessionDuplicates(
          env,
          owner,
          route.sessionId,
        ),
      );

    case 'match':
      if (request.method !== 'POST') {
        return methodNotAllowed(['POST']);
      }
      return json(
        await matchUploadSessionFiles(
          env,
          owner,
          route.sessionId,
          validateMatchUploadSessionRequest(
            await request.json(),
          ),
        ),
      );

    case 'authorize-batch':
      if (request.method !== 'POST') {
        return methodNotAllowed(['POST']);
      }
      return json(
        await authorizeSessionBatch(
          env,
          owner,
          route.sessionId,
          validateAuthorizeSessionBatchRequest(
            await request.json(),
          ).sessionFileIds,
          requestId,
        ),
        { status: 201 },
      );

    case 'record-uploaded':
      if (request.method !== 'POST') {
        return methodNotAllowed(['POST']);
      }
      return json(
        await recordSessionUpload(
          env,
          owner,
          route.sessionId,
          validateRecordSessionUploadRequest(
            await request.json(),
          ),
          requestId,
        ),
      );

    case 'record-failed':
      if (request.method !== 'POST') {
        return methodNotAllowed(['POST']);
      }
      return json(
        await recordSessionFailure(
          env,
          owner,
          route.sessionId,
          validateRecordSessionFailureRequest(
            await request.json(),
          ),
          requestId,
        ),
      );

    case 'file':
      if (request.method !== 'PATCH') {
        return methodNotAllowed(['PATCH']);
      }
      return json(
        await updateSessionFile(
          env,
          owner,
          route.sessionId,
          route.fileId,
          validateUpdateSessionFileRequest(
            await request.json(),
          ),
        ),
      );

    case 'review':
      if (request.method !== 'PATCH') {
        return methodNotAllowed(['PATCH']);
      }
      return json(
        await updateSessionReview(
          env,
          owner,
          route.sessionId,
          validateUpdateSessionReviewRequest(
            await request.json(),
          ),
        ),
      );

    case 'confirm':
      if (request.method !== 'POST') {
        return methodNotAllowed(['POST']);
      }
      return json(
        await confirmUploadSession(
          env,
          owner,
          route.sessionId,
          requestId,
        ),
      );
  }
}