import {
  readBlobAsArrayBuffer,
} from './blob-bytes';
import {
  bytesToHex,
} from './photo-fingerprint';

export async function hashFileBytes(
  file: Blob,
): Promise<string> {
  const bytes = await readBlobAsArrayBuffer(file);

  const digest = await crypto.subtle.digest(
    'SHA-256',
    bytes,
  );

  return bytesToHex(new Uint8Array(digest));
}