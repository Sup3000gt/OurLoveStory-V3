/// <reference lib="webworker" />

import { hashFileBytes } from '../lib/photo-hash-core';

interface HashRequest {
  id: string;
  file: File;
}

type HashResponse =
  | {
      id: string;
      ok: true;
      contentHash: string;
    }
  | {
      id: string;
      ok: false;
      errorCode: 'CONTENT_HASH_FAILED';
    };

const workerScope =
  self as unknown as DedicatedWorkerGlobalScope;

workerScope.onmessage = async (
  event: MessageEvent<HashRequest>,
) => {
  const { id, file } = event.data;

  try {
    const contentHash = await hashFileBytes(file);

    workerScope.postMessage({
      id,
      ok: true,
      contentHash,
    } satisfies HashResponse);
  } catch {
    workerScope.postMessage({
      id,
      ok: false,
      errorCode: 'CONTENT_HASH_FAILED',
    } satisfies HashResponse);
  }
};