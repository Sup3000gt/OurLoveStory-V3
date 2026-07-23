import type {
  AuthorizeSessionBatchRequest,
  AuthorizeSessionBatchResponse,
  AuthorizeUploadsResponse,
  CheckUploadSessionDuplicatesResponse,
  CreateMemoryRequest,
  CreateUploadSessionRequest,
  DeleteAssetResponse,
  Memory,
  MemoryPage,
  OwnerSession,
  RecordSessionFailureRequest,
  RecordSessionUploadRequest,
  TimelineCoverInput,
  TimelinePeriodType,
  TimelineResponse,
  UpdateAssetVisibilityResponse,
  UpdateSessionFileRequest,
  UpdateSessionReviewRequest,
  UploadFileRequest,
  UploadSession,
  UploadSessionMatchRequest,
  UploadSessionMatchResponse,
  UploadSessionSummary,
  Visibility,
} from '../../shared/contracts';
import {
  requireOwnerSessionToken,
} from './owner-session';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || '/api'
).replace(/\/$/, '');

export type GetToken =
  () => Promise<string | null>;

export interface MemoryPageOptions {
  cursor?: string | null;
  limit?: number;
  category?: Memory['category'] | null;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(
    status: number,
    message: string,
    code: string | null = null,
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

export class DirectUploadError extends Error {
  readonly filename: string;
  readonly status: number | null;
  readonly originalError: unknown;

  constructor(
    filename: string,
    status: number | null,
    originalError: unknown = null,
  ) {
    super(
      status === null
        ? `Network error while uploading ${filename}.`
        : `Upload failed for ${filename} (${status}).`,
    );
    this.name = 'DirectUploadError';
    this.filename = filename;
    this.status = status;
    this.originalError = originalError;
  }
}

export async function getOwnerSession(
  getToken: GetToken,
): Promise<OwnerSession> {
  const token = await requireOwnerSessionToken(
    getToken,
  );

  return apiRequest<OwnerSession>(
    '/session',
    undefined,
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );
}

export async function getMemories(
  getToken?: GetToken,
  options: MemoryPageOptions = {},
): Promise<MemoryPage> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 12),
  });
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.category) params.set('category', options.category);

  return await apiRequest<MemoryPage>(
    `/memories?${params.toString()}`,
    getToken,
  );
}

export async function getMemory(
  memoryId: string,
  getToken?: GetToken,
): Promise<Memory> {
  return await apiRequest<Memory>(
    `/memories/${encodeURIComponent(memoryId)}`,
    getToken,
  );
}

export async function getTimeline(): Promise<TimelineResponse> {
  return apiRequest<TimelineResponse>('/timeline');
}

export async function setTimelineCover(
  input: TimelineCoverInput,
  getToken: GetToken,
): Promise<TimelineCoverInput> {
  return apiRequest<TimelineCoverInput>(
    '/timeline/covers',
    getToken,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export async function clearTimelineCover(
  periodType: TimelinePeriodType,
  periodKey: string,
  getToken: GetToken,
): Promise<void> {
  const params = new URLSearchParams({ periodType, periodKey });

  return apiRequest<void>(
    `/timeline/covers?${params.toString()}`,
    getToken,
    { method: 'DELETE' },
  );
}

export async function authorizeUploads(
  selectedFiles: File[],
  getToken: GetToken,
): Promise<AuthorizeUploadsResponse> {
  const payload: {
    files: UploadFileRequest[];
  } = {
    files: selectedFiles.map((file) => ({
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    })),
  };

  return apiRequest<AuthorizeUploadsResponse>(
    '/uploads',
    getToken,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function createMemory(
  memory: CreateMemoryRequest,
  getToken: GetToken,
): Promise<Memory> {
  return apiRequest<Memory>(
    '/memories',
    getToken,
    {
      method: 'POST',
      body: JSON.stringify(memory),
    },
  );
}

export async function createUploadSession(
  input: CreateUploadSessionRequest,
  getToken: GetToken,
): Promise<UploadSession> {
  return apiRequest<UploadSession>(
    '/upload-sessions',
    getToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function listUploadSessions(
  getToken: GetToken,
): Promise<UploadSessionSummary[]> {
  const response = await apiRequest<{
    sessions: UploadSessionSummary[];
  }>('/upload-sessions', getToken);

  return response.sessions;
}

export async function getUploadSession(
  sessionId: string,
  getToken: GetToken,
): Promise<UploadSession> {
  return apiRequest<UploadSession>(
    `/upload-sessions/${encodeURIComponent(sessionId)}`,
    getToken,
  );
}

export async function checkUploadSessionDuplicates(
  sessionId: string,
  getToken: GetToken,
): Promise<CheckUploadSessionDuplicatesResponse> {
  return apiRequest<CheckUploadSessionDuplicatesResponse>(
    `/upload-sessions/${encodeURIComponent(sessionId)}/check-duplicates`,
    getToken,
    {
      method: 'POST',
    },
  );
}

export async function matchUploadSessionFiles(
  sessionId: string,
  input: UploadSessionMatchRequest,
  getToken: GetToken,
): Promise<UploadSessionMatchResponse> {
  return apiRequest<UploadSessionMatchResponse>(
    `/upload-sessions/${encodeURIComponent(sessionId)}/match`,
    getToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function authorizeUploadSessionBatch(
  sessionId: string,
  input: AuthorizeSessionBatchRequest,
  getToken: GetToken,
): Promise<AuthorizeSessionBatchResponse> {
  return apiRequest<AuthorizeSessionBatchResponse>(
    `/upload-sessions/${encodeURIComponent(sessionId)}/authorize-batch`,
    getToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function recordUploadSessionFile(
  sessionId: string,
  input: RecordSessionUploadRequest,
  getToken: GetToken,
): Promise<UploadSession> {
  return apiRequest<UploadSession>(
    `/upload-sessions/${encodeURIComponent(sessionId)}/record-uploaded`,
    getToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function recordUploadSessionFailure(
  sessionId: string,
  input: RecordSessionFailureRequest,
  getToken: GetToken,
): Promise<UploadSession> {
  return apiRequest<UploadSession>(
    `/upload-sessions/${encodeURIComponent(sessionId)}/record-failed`,
    getToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function updateUploadSessionFile(
  sessionId: string,
  fileId: string,
  input: UpdateSessionFileRequest,
  getToken: GetToken,
): Promise<UploadSession> {
  return apiRequest<UploadSession>(
    `/upload-sessions/${encodeURIComponent(sessionId)}/files/${encodeURIComponent(fileId)}`,
    getToken,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export async function updateUploadSessionReview(
  sessionId: string,
  input: UpdateSessionReviewRequest,
  getToken: GetToken,
): Promise<UploadSession> {
  return apiRequest<UploadSession>(
    `/upload-sessions/${encodeURIComponent(sessionId)}/review`,
    getToken,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export async function confirmUploadSession(
  sessionId: string,
  getToken: GetToken,
): Promise<Memory> {
  return apiRequest<Memory>(
    `/upload-sessions/${encodeURIComponent(sessionId)}/confirm`,
    getToken,
    {
      method: 'POST',
    },
  );
}

export async function abandonUploadSession(
  sessionId: string,
  getToken: GetToken,
): Promise<void> {
  return apiRequest<void>(
    `/upload-sessions/${encodeURIComponent(sessionId)}`,
    getToken,
    {
      method: 'DELETE',
    },
  );
}

export async function updateAssetVisibility(
  assetId: string,
  visibility: Visibility,
  getToken: GetToken,
): Promise<UpdateAssetVisibilityResponse> {
  return apiRequest<UpdateAssetVisibilityResponse>(
    `/assets/${encodeURIComponent(assetId)}`,
    getToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ visibility }),
    },
  );
}

export async function deleteMemoryAsset(
  assetId: string,
  getToken: GetToken,
): Promise<DeleteAssetResponse> {
  return apiRequest<DeleteAssetResponse>(
    `/assets/${encodeURIComponent(assetId)}`,
    getToken,
    {
      method: 'DELETE',
    },
  );
}

export async function uploadFileDirectly(
  uploadUrl: string,
  headers: Record<string, string>,
  file: File,
): Promise<void> {
  let response: Response;

  try {
    response = await fetch(uploadUrl, {
      method: 'PUT',
      headers,
      body: file,
    });
  } catch (error) {
    throw new DirectUploadError(
      file.name,
      null,
      error,
    );
  }

  if (!response.ok) {
    throw new DirectUploadError(
      file.name,
      response.status,
    );
  }
}

async function apiRequest<T>(
  path: string,
  getToken?: GetToken,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body) {
    headers.set(
      'content-type',
      'application/json',
    );
  }

  if (getToken) {
    const token = await requireOwnerSessionToken(
      getToken,
    );

    headers.set(
      'authorization',
      `Bearer ${token}`,
    );
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...init,
      headers,
      credentials: 'same-origin',
    },
  );

  if (!response.ok) {
    let message =
      `Request failed (${response.status}).`;

    let code: string | null = null;

    try {
      const body = await response.json() as {
        error?: string;
        code?: string;
      };

      if (body.error) {
        message = body.error;
      }

      if (body.code) {
        code = body.code;
      }
    } catch {
      // Keep the status-based message.
    }

    throw new ApiRequestError(
      response.status,
      message,
      code,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return await response.json() as T;
}
