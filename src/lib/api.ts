import type {
  AuthorizeUploadsResponse,
  CreateMemoryRequest,
  Memory,
  OwnerSession,
  UploadFileRequest,
} from '../../shared/contracts';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
export type GetToken = () => Promise<string | null>;

export async function getOwnerSession(getToken: GetToken): Promise<OwnerSession> {
  return apiRequest<OwnerSession>('/session', getToken);
}

export async function getMemories(getToken?: GetToken): Promise<Memory[]> {
  const response = await apiRequest<{ memories: Memory[] }>('/memories', getToken);
  return response.memories;
}

export async function authorizeUploads(
  files: File[],
  getToken: GetToken,
): Promise<AuthorizeUploadsResponse> {
  const payload: { files: UploadFileRequest[] } = {
    files: files.map((file) => ({
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

export async function uploadFileDirectly(
  uploadUrl: string,
  headers: Record<string, string>,
  file: File,
): Promise<void> {
  const response = await fetch(uploadUrl, { method: 'PUT', headers, body: file });
  if (!response.ok) {
    throw new Error(`Upload failed for ${file.name} (${response.status}).`);
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
    const token = await getToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
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
