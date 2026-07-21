import {
  readBlobAsArrayBuffer,
} from './blob-bytes';

const FINGERPRINT_CHUNK_BYTES = 64 * 1024;

export async function fingerprintPhoto(
  file: File,
): Promise<string> {
  const first = await readBlobAsArrayBuffer(
    file.slice(0, FINGERPRINT_CHUNK_BYTES),
  );

  const lastStart = Math.max(
    0,
    file.size - FINGERPRINT_CHUNK_BYTES,
  );

  const last = await readBlobAsArrayBuffer(
    file.slice(lastStart),
  );

  const metadata = new TextEncoder().encode(
    [
      file.name,
      file.size,
      file.lastModified,
      file.type.toLowerCase(),
    ].join('\n'),
  );

  const combined = new Uint8Array(
    metadata.byteLength
      + first.byteLength
      + last.byteLength,
  );

  combined.set(metadata, 0);
  combined.set(
    new Uint8Array(first),
    metadata.byteLength,
  );
  combined.set(
    new Uint8Array(last),
    metadata.byteLength + first.byteLength,
  );

  const digest = await crypto.subtle.digest(
    'SHA-256',
    combined,
  );

  return bytesToHex(new Uint8Array(digest));
}

export function assignOccurrenceIndexes(
  fingerprints: string[],
): number[] {
  const counts = new Map<string, number>();

  return fingerprints.map((fingerprint) => {
    const occurrenceIndex =
      counts.get(fingerprint) ?? 0;

    counts.set(
      fingerprint,
      occurrenceIndex + 1,
    );

    return occurrenceIndex;
  });
}

export function bytesToHex(
  bytes: Uint8Array,
): string {
  return [...bytes]
    .map((value) =>
      value.toString(16).padStart(2, '0'),
    )
    .join('');
}