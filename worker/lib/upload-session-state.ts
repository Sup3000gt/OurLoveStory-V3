import type {
  UploadSessionFileStatus,
  UploadSessionStatus,
} from '../../shared/contracts';
import { MAX_ASSETS_PER_MEMORY } from '../../shared/upload-constants';
import { HttpError } from './responses';

export function calculateSessionProgress(
  statuses: UploadSessionFileStatus[],
): {
  completedFileCount: number;
  acceptedFileCount: number;
} {
  return {
    completedFileCount: statuses.filter(
      (status) =>
        status === 'uploaded' || status === 'skipped',
    ).length,
    acceptedFileCount: statuses.filter(
      (status) => status === 'uploaded',
    ).length,
  };
}

export function nextSessionStatus(
  statuses: UploadSessionFileStatus[],
): UploadSessionStatus {
  return (
    statuses.length > 0
    && statuses.every(
      (status) =>
        status === 'uploaded' || status === 'skipped',
    )
  )
    ? 'review'
    : 'uploading';
}

export function ensureMemoryCapacity(
  currentCount: number,
  acceptedNewCount: number,
): void {
  if (
    currentCount + acceptedNewCount
    > MAX_ASSETS_PER_MEMORY
  ) {
    const remaining = Math.max(
      0,
      MAX_ASSETS_PER_MEMORY - currentCount,
    );
    throw new HttpError(
      409,
      `This album can accept only ${remaining} more photos; the maximum is 1,000.`,
    );
  }
}

export function shouldSkipDuplicate(
  duplicateExists: boolean,
  allowDuplicate: boolean,
): boolean {
  return duplicateExists && !allowDuplicate;
}

export function planInitialSessionFiles(
  files: Array<{ contentHash: string }>,
  existingHashes: Set<string>,
): Array<{
  status: 'pending' | 'skipped';
  duplicate: boolean;
}> {
  const seen = new Set<string>();

  return files.map((file) => {
    const duplicate =
      existingHashes.has(file.contentHash)
      || seen.has(file.contentHash);
    seen.add(file.contentHash);

    return duplicate
      ? { status: 'skipped', duplicate: true }
      : { status: 'pending', duplicate: false };
  });
}