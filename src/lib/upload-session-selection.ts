import type {
  UploadSession,
  UploadSessionFile,
  UploadSessionFileStatus,
  Visibility,
} from '../../shared/contracts';
import {
  assignOccurrenceIndexes,
  fingerprintPhoto,
} from './photo-fingerprint';
import type {
  ContentHasher,
} from './photo-hash-client';

export type LocalPhotoStatus =
  | 'fingerprinting'
  | 'hashing'
  | 'duplicate'
  | 'pending'
  | 'authorizing'
  | 'uploading'
  | 'retrying'
  | 'uploaded'
  | 'failed'
  | 'skipped';

export interface PreparedPhotoMetadata {
  localId: string;
  file: File;
  resumeFingerprint: string;
  contentHash: string;
  occurrenceIndex: number;
  targetVisibility: Visibility;
}

export interface BoundLocalPhoto
  extends PreparedPhotoMetadata {
  sessionFileId: string;
  serverStatus: UploadSessionFileStatus;
  status: LocalPhotoStatus;
  allowDuplicate: boolean;
}

export interface PhotoPreparationEvent {
  index: number;
  total: number;
  filename: string;
  stage: 'fingerprinting' | 'hashing';
}

export async function preparePhotoMetadata(
  files: File[],
  hasher: ContentHasher,
  onEvent?: (
    event: PhotoPreparationEvent,
  ) => void,
): Promise<PreparedPhotoMetadata[]> {
  const fingerprints: string[] = [];

  for (
    let index = 0;
    index < files.length;
    index += 1
  ) {
    const file = files[index]!;

    onEvent?.({
      index,
      total: files.length,
      filename: file.name,
      stage: 'fingerprinting',
    });

    fingerprints.push(
      await fingerprintPhoto(file),
    );
  }

  const occurrenceIndexes =
    assignOccurrenceIndexes(fingerprints);

  const contentHashes: string[] = [];

  for (
    let index = 0;
    index < files.length;
    index += 1
  ) {
    const file = files[index]!;

    onEvent?.({
      index,
      total: files.length,
      filename: file.name,
      stage: 'hashing',
    });

    contentHashes.push(
      await hasher.hash(file),
    );
  }

  return files.map((file, index) => ({
    localId: crypto.randomUUID(),
    file,
    resumeFingerprint: fingerprints[index]!,
    contentHash: contentHashes[index]!,
    occurrenceIndex: occurrenceIndexes[index]!,
    targetVisibility: 'private',
  }));
}

export function matchLocalPhotosToSession(
  localPhotos: PreparedPhotoMetadata[],
  sessionFiles: UploadSessionFile[],
): Array<{
  localId: string;
  sessionFileId: string;
}> {
  const remaining = new Set(
    sessionFiles.map((file) => file.id),
  );

  return localPhotos.map((localPhoto) => {
    const serverFile = sessionFiles.find(
      (file) =>
        remaining.has(file.id)
        && file.resumeFingerprint
          === localPhoto.resumeFingerprint
        && file.occurrenceIndex
          === localPhoto.occurrenceIndex
        && file.filename === localPhoto.file.name
        && file.sizeBytes === localPhoto.file.size,
    );

    if (!serverFile) {
      throw new Error(
        `${localPhoto.file.name} could not be matched to the upload Session.`,
      );
    }

    remaining.delete(serverFile.id);

    return {
      localId: localPhoto.localId,
      sessionFileId: serverFile.id,
    };
  });
}

export function bindLocalPhotosToSession(
  localPhotos: PreparedPhotoMetadata[],
  session: UploadSession,
): BoundLocalPhoto[] {
  const matches = matchLocalPhotosToSession(
    localPhotos,
    session.files,
  );

  const serverById = new Map(
    session.files.map((file) => [file.id, file]),
  );

  return matches.map((match) => {
    const local = localPhotos.find(
      (photo) => photo.localId === match.localId,
    )!;

    const server = serverById.get(
      match.sessionFileId,
    )!;

    return {
      ...local,
      targetVisibility: server.targetVisibility,
      sessionFileId: server.id,
      serverStatus: server.status,
      status: localStatusForSessionFile(server),
      allowDuplicate: server.allowDuplicate,
    };
  });
}

export function pendingLocalPhotos(
  photos: BoundLocalPhoto[],
): BoundLocalPhoto[] {
  return photos.filter((photo) =>
    photo.serverStatus !== 'uploaded'
    && photo.serverStatus !== 'skipped',
  );
}

export function localStatusForSessionFile(
  file: UploadSessionFile,
): LocalPhotoStatus {
  if (
    file.status === 'skipped'
    && file.lastError === 'duplicate'
    && !file.allowDuplicate
  ) {
    return 'duplicate';
  }

  switch (file.status) {
    case 'pending':
    case 'authorized':
      return 'pending';
    case 'uploading':
      return 'uploading';
    case 'uploaded':
      return 'uploaded';
    case 'failed':
      return 'failed';
    case 'skipped':
      return 'skipped';
  }
}

export interface UploadSessionMatchSummary {
  missingSessionFileIds:
    readonly string[];
  unmatchedLocalIds:
    readonly string[];
}

export function hasCompleteUploadSessionMatch(
  match:
    UploadSessionMatchSummary,
): boolean {
  return (
    match
      .missingSessionFileIds
      .length === 0
    && match
      .unmatchedLocalIds
      .length === 0
  );
}
