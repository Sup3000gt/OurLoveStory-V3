import { useAuth } from '@clerk/react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  CreatePhotoSessionRequest,
  MemoryCategory,
  MemoryStatus,
  UploadSession,
  Visibility,
} from '../../shared/contracts';
import {
  createUploadSession,
  getUploadSession,
  matchUploadSessionFiles,
  updateUploadSessionFile,
} from '../lib/api';
import {
  classifySelection,
} from '../lib/photo-file';
import {
  PhotoHashClient,
} from '../lib/photo-hash-client';
import {
  uploadPendingSessionPhotos,
  type SessionUploadPhoto,
} from '../lib/photo-session-upload';
import {
  bindLocalPhotosToSession,
  preparePhotoMetadata,
  type BoundLocalPhoto,
  type LocalPhotoStatus,
  type PreparedPhotoMetadata,
} from '../lib/upload-session-selection';

export interface SelectedPhoto
  extends PreparedPhotoMetadata {
  previewUrl: string;
  sessionFileId: string | null;
  status: LocalPhotoStatus;
  allowDuplicate: boolean;
  message: string;
}

export interface CreatePhotoSessionMetadata {
  title: string;
  location: string;
  date: string;
  category: MemoryCategory;
  description: string;
  featured: boolean;
  targetMemoryStatus: MemoryStatus;
}

export function usePhotoSessionUpload() {
  const { getToken } = useAuth();
  const hashClientRef =
    useRef<PhotoHashClient | null>(null);
  const photosRef =
    useRef<SelectedPhoto[]>([]);

  const [photos, setPhotos] =
    useState<SelectedPhoto[]>([]);
  const [session, setSession] =
    useState<UploadSession | null>(null);
  const [busy, setBusy] =
    useState(false);
  const [progressText, setProgressText] =
    useState('');
  const [errorText, setErrorText] =
    useState('');

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => () => {
    for (const photo of photosRef.current) {
      URL.revokeObjectURL(photo.previewUrl);
    }

    hashClientRef.current?.dispose();
  }, []);

  const getHasher = useCallback(() => {
    hashClientRef.current ??=
      new PhotoHashClient();

    return hashClientRef.current;
  }, []);

  const replacePhotos = useCallback(
    (next: SelectedPhoto[]) => {
      for (const photo of photosRef.current) {
        URL.revokeObjectURL(photo.previewUrl);
      }

      setPhotos(next);
    },
    [],
  );

  const selectPhotos = useCallback(
    async (files: File[]) => {
      const mode = classifySelection(files);

      if (mode.mode !== 'photo-session') {
        throw new Error(
          'Selections containing video must use the legacy uploader.',
        );
      }

      setBusy(true);
      setErrorText('');

      try {
        const prepared =
          await preparePhotoMetadata(
            files,
            getHasher(),
            (event) => {
              setProgressText(
                `${event.stage === 'hashing'
                  ? 'Checking duplicate content'
                  : 'Preparing resume data'}: `
                + `${event.filename} `
                + `(${event.index + 1}/${event.total})`,
              );
            },
          );

        replacePhotos(
          prepared.map((photo) => ({
            ...photo,
            previewUrl:
              URL.createObjectURL(photo.file),
            sessionFileId: null,
            status: 'pending',
            allowDuplicate: false,
            message: '',
          })),
        );

        setSession(null);
      } catch (error) {
        setErrorText(
          error instanceof Error
            ? error.message
            : 'The selected photos could not be prepared.',
        );

        throw error;
      } finally {
        setBusy(false);
        setProgressText('');
      }
    },
    [getHasher, replacePhotos],
  );

  const attachSession = useCallback(
    (
      prepared: SelectedPhoto[],
      nextSession: UploadSession,
    ) => {
      const bound = bindLocalPhotosToSession(
        prepared,
        nextSession,
      );

      const previewByLocalId = new Map(
        prepared.map((photo) => [
          photo.localId,
          photo.previewUrl,
        ]),
      );

      setPhotos(
        bound.map((photo) => ({
          ...photo,
          previewUrl:
            previewByLocalId.get(
              photo.localId,
            )!,
          message: '',
        })),
      );

      setSession(nextSession);
    },
    [],
  );

  const startCreate = useCallback(
    async (
      metadata: CreatePhotoSessionMetadata,
    ) => {
      if (photos.length === 0) {
        throw new Error(
          'Choose at least one photo.',
        );
      }

      setBusy(true);
      setErrorText('');

      try {
        const request:
          CreatePhotoSessionRequest = {
            sessionKind: 'create',
            ...metadata,
            files: photos.map(
              (photo, originalSortOrder) => ({
                resumeFingerprint:
                  photo.resumeFingerprint,
                contentHash:
                  photo.contentHash,
                occurrenceIndex:
                  photo.occurrenceIndex,
                filename:
                  photo.file.name,
                mimeType:
                  photo.file.type.toLowerCase(),
                sizeBytes:
                  photo.file.size,
                originalSortOrder,
                targetVisibility:
                  photo.targetVisibility,
              }),
            ),
          };

        const nextSession =
          await createUploadSession(
            request,
            getToken,
          );

        attachSession(
          photos,
          nextSession,
        );

        return nextSession;
      } catch (error) {
        setErrorText(
          error instanceof Error
            ? error.message
            : 'The photo Session could not be created.',
        );

        throw error;
      } finally {
        setBusy(false);
      }
    },
    [
      attachSession,
      getToken,
      photos,
    ],
  );

  const startAppend = useCallback(
    async (memoryId: string) => {
      if (photos.length === 0) {
        throw new Error(
          'Choose at least one photo.',
        );
      }

      setBusy(true);
      setErrorText('');

      try {
        const nextSession =
          await createUploadSession(
            {
              sessionKind: 'append',
              memoryId,
              files: photos.map(
                (
                  photo,
                  originalSortOrder,
                ) => ({
                  resumeFingerprint:
                    photo.resumeFingerprint,
                  contentHash:
                    photo.contentHash,
                  occurrenceIndex:
                    photo.occurrenceIndex,
                  filename:
                    photo.file.name,
                  mimeType:
                    photo.file.type.toLowerCase(),
                  sizeBytes:
                    photo.file.size,
                  originalSortOrder,
                  targetVisibility:
                    photo.targetVisibility,
                }),
              ),
            },
            getToken,
          );

        attachSession(
          photos,
          nextSession,
        );

        return nextSession;
      } catch (error) {
        setErrorText(
          error instanceof Error
            ? error.message
            : 'The photo addition could not be created.',
        );

        throw error;
      } finally {
        setBusy(false);
      }
    },
    [
      attachSession,
      getToken,
      photos,
    ],
  );

  const resume = useCallback(
    async (
      sessionId: string,
      files: File[],
    ) => {
      setBusy(true);
      setErrorText('');

      try {
        const mode = classifySelection(files);

        if (mode.mode !== 'photo-session') {
          throw new Error(
            'Only photos can resume this Session.',
          );
        }

        const prepared =
          await preparePhotoMetadata(
            files,
            getHasher(),
          );

        const previews:
          SelectedPhoto[] = prepared.map(
            (photo) => ({
              ...photo,
              previewUrl:
                URL.createObjectURL(
                  photo.file,
                ),
              sessionFileId: null,
              status: 'pending',
              allowDuplicate: false,
              message: '',
            }),
          );

        const nextSession =
          await getUploadSession(
            sessionId,
            getToken,
          );

        const match =
          await matchUploadSessionFiles(
            sessionId,
            {
              files: previews.map(
                (photo) => ({
                  localId:
                    photo.localId,
                  resumeFingerprint:
                    photo.resumeFingerprint,
                  occurrenceIndex:
                    photo.occurrenceIndex,
                  filename:
                    photo.file.name,
                  sizeBytes:
                    photo.file.size,
                }),
              ),
            },
            getToken,
          );

        if (
          match.missingSessionFileIds.length > 0
          || match.unmatchedLocalIds.length > 0
        ) {
          for (const photo of previews) {
            URL.revokeObjectURL(
              photo.previewUrl,
            );
          }

          throw new Error(
            'Reselect every original photo from this upload Session.',
          );
        }

        replacePhotos([]);
        attachSession(
          previews,
          nextSession,
        );

        return nextSession;
      } catch (error) {
        setErrorText(
          error instanceof Error
            ? error.message
            : 'The photo Session could not be resumed.',
        );

        throw error;
      } finally {
        setBusy(false);
      }
    },
    [
      attachSession,
      getHasher,
      getToken,
      replacePhotos,
    ],
  );

  const uploadPending = useCallback(
    async () => {
      if (!session) {
        throw new Error(
          'Create or resume an upload Session first.',
        );
      }

      const uploadPhotos:
        SessionUploadPhoto[] = photos
          .filter(
            (
              photo,
            ): photo is SelectedPhoto & {
              sessionFileId: string;
            } =>
              photo.sessionFileId !== null,
          )
          .map((photo) => ({
            localId: photo.localId,
            sessionFileId:
              photo.sessionFileId,
            file: photo.file,
            status:
              statusForUpload(photo.status),
          }));

      setBusy(true);
      setErrorText('');

      try {
        await uploadPendingSessionPhotos({
          sessionId: session.id,
          photos: uploadPhotos,
          getToken,
          onEvent: (event) => {
            setPhotos((current) =>
              current.map((photo) =>
                photo.localId === event.id
                  ? {
                      ...photo,
                      status:
                        event.state,
                      message:
                        `${event.filename} `
                        + `${event.completed}/${event.total}`,
                    }
                  : photo,
              ),
            );

            setProgressText(
              `${event.filename} `
              + `${event.completed}/${event.total}`,
            );
          },
        });

        const refreshed =
          await getUploadSession(
            session.id,
            getToken,
          );

        attachSession(
          photos,
          refreshed,
        );

        return refreshed;
      } catch (error) {
        setErrorText(
          error instanceof Error
            ? error.message
            : 'One or more photos did not upload.',
        );

        throw error;
      } finally {
        setBusy(false);
        setProgressText('');
      }
    },
    [
      attachSession,
      getToken,
      photos,
      session,
    ],
  );

  const setVisibility = useCallback(
    async (
      localId: string,
      visibility: Visibility,
    ) => {
      const target = photos.find(
        (photo) =>
          photo.localId === localId,
      );

      if (!target) return;

      setPhotos((current) =>
        current.map((photo) =>
          photo.localId === localId
            ? {
                ...photo,
                targetVisibility:
                  visibility,
              }
            : photo,
        ),
      );

      if (
        session
        && target.sessionFileId
      ) {
        const refreshed =
          await updateUploadSessionFile(
            session.id,
            target.sessionFileId,
            {
              targetVisibility:
                visibility,
            },
            getToken,
          );

        attachSession(
          photos.map((photo) =>
            photo.localId === localId
              ? {
                  ...photo,
                  targetVisibility:
                    visibility,
                }
              : photo,
          ),
          refreshed,
        );
      }
    },
    [
      attachSession,
      getToken,
      photos,
      session,
    ],
  );

  const keepDuplicate = useCallback(
    async (localId: string) => {
      if (!session) {
        throw new Error(
          'The duplicate has no upload Session.',
        );
      }

      const target = photos.find(
        (photo) =>
          photo.localId === localId,
      );

      if (!target?.sessionFileId) {
        throw new Error(
          'The duplicate could not be matched.',
        );
      }

      const refreshed =
        await updateUploadSessionFile(
          session.id,
          target.sessionFileId,
          {
            allowDuplicate: true,
            skipped: false,
          },
          getToken,
        );

      attachSession(
        photos,
        refreshed,
      );
    },
    [
      attachSession,
      getToken,
      photos,
      session,
    ],
  );

  const removePhoto = useCallback(
    async (localId: string) => {
      const target = photos.find(
        (photo) =>
          photo.localId === localId,
      );

      if (!target) return;

      if (
        session
        && target.sessionFileId
      ) {
        const refreshed =
          await updateUploadSessionFile(
            session.id,
            target.sessionFileId,
            {
              skipped: true,
            },
            getToken,
          );

        attachSession(
          photos,
          refreshed,
        );

        return;
      }

      URL.revokeObjectURL(
        target.previewUrl,
      );

      setPhotos((current) =>
        current.filter(
          (photo) =>
            photo.localId !== localId,
        ),
      );
    },
    [
      attachSession,
      getToken,
      photos,
      session,
    ],
  );

  const reset = useCallback(() => {
    for (const photo of photosRef.current) {
      URL.revokeObjectURL(
        photo.previewUrl,
      );
    }

    setPhotos([]);
    setSession(null);
    setProgressText('');
    setErrorText('');
  }, []);

  return {
    photos,
    session,
    busy,
    progressText,
    errorText,
    selectPhotos,
    startCreate,
    startAppend,
    resume,
    uploadPending,
    setVisibility,
    keepDuplicate,
    removePhoto,
    reset,
  };
}

function statusForUpload(
  status: LocalPhotoStatus,
) {
  switch (status) {
    case 'uploaded':
      return 'uploaded' as const;
    case 'duplicate':
    case 'skipped':
      return 'skipped' as const;
    case 'failed':
      return 'failed' as const;
    case 'uploading':
      return 'uploading' as const;
    default:
      return 'pending' as const;
  }
}