import type {
  AuthorizeUploadsResponse,
  CreateMemoryRequest,
  DeleteAssetResponse,
  Memory,
  OwnerSession,
  UpdateAssetVisibilityResponse,
  UploadFileRequest,
  Visibility,
} from '../../shared/contracts';
import { requireOwnerSessionToken } from './owner-session';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
export type GetToken = () => Promise<string | null>;

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

export async function getOwnerSession(getToken: GetToken): Promise<OwnerSession> {
  const token = await requireOwnerSessionToken(getToken);
  return apiRequest<OwnerSession>('/session', undefined, {
    headers: { authorization: `Bearer ${token}` },
  });
}

export async function getMemories(getToken?: GetToken): Promise<Memory[]> {
  const response = await apiRequest<{ memories: Memory[] }>('/memories', getToken);
  return response.memories;
}

export async function authorizeUploads(
  selectedFiles: File[],
  getToken: GetToken,
): Promise<AuthorizeUploadsResponse> {
  const payload: { files: UploadFileRequest[] } = {
    files: selectedFiles.map((file) => ({
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    })),
  };
  return apiRequest<AuthorizeUploadsResponse>('/uploads', getToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createMemory(
  memory: CreateMemoryRequest,
  getToken: GetToken,
): Promise<Memory> {
  return apiRequest<Memory>('/memories', getToken, {
    method: 'POST',
    body: JSON.stringify(memory),
  });
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
    { method: 'DELETE' },
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
    throw new DirectUploadError(file.name, null, error);
  }

  if (!response.ok) {
    throw new DirectUploadError(file.name, response.status);
  }
}

async function apiRequest<T>(
  path: string,
  getToken?: GetToken,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('content-type', 'application/json');

  if (getToken) {
    const token = await requireOwnerSessionToken(getToken);
    headers.set('authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'same-origin',
  });

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep the status-based message when the response is not JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}