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
  normalizeSelectedMediaFiles,
} from '../lib/heic-conversion';
import {
  PhotoHashClient,
} from '../lib/photo-hash-client';
import {
  uploadPendingSessionPhotos,
  type SessionUploadPhoto,
} from '../lib/photo-session-upload';
import {
  bindLocalPhotosToSession,
  hasCompleteUploadSessionMatch,
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
      const retainedUrls = new Set(
        next.map((photo) => photo.previewUrl),
      );

      for (const photo of photosRef.current) {
        if (!retainedUrls.has(photo.previewUrl)) {
          URL.revokeObjectURL(photo.previewUrl);
        }
      }

      setPhotos(next);
    },
    [],
  );

  const selectPhotos = useCallback(
    async (files: File[]) => {
      setBusy(true);
      setErrorText('');

      try {
        const normalizedFiles =
          await normalizeSelectedMediaFiles(
            files,
            {
              onConvert: (event) => {
                setProgressText(
                  `Converting ${event.filename} to JPEG `
                  + `(${event.index + 1}/${event.total})`,
                );
              },
            },
          );
        const mode =
          classifySelection(
            normalizedFiles,
          );

        if (mode.mode !== 'photo-session') {
          throw new Error(
            'Selections containing video must use the legacy uploader.',
          );
        }

        const prepared =
          await preparePhotoMetadata(
            normalizedFiles,
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
      selected: SelectedPhoto[],
      nextSession: UploadSession,
    ): SelectedPhoto[] => {
      const bound = bindSelectedPhotos(
        selected,
        nextSession,
      );

      replacePhotos(bound);
      setSession(nextSession);

      return bound;
    },
    [replacePhotos],
  );

  const uploadBoundSession = useCallback(
    async (
      targetSession: UploadSession,
      targetPhotos: SelectedPhoto[],
    ): Promise<UploadSession> => {
      await uploadPendingSessionPhotos({
        sessionId: targetSession.id,
        photos:
          toSessionUploadPhotos(
            targetPhotos,
          ),
        getToken,
        onEvent: (event) => {
          setPhotos((current) =>
            current.map((photo) =>
              photo.localId === event.id
                ? {
                    ...photo,
                    status: event.state,
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
          targetSession.id,
          getToken,
        );

      attachSession(
        targetPhotos,
        refreshed,
      );

      return refreshed;
    },
    [
      attachSession,
      getToken,
    ],
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
                width:
                  photo.width,
                height:
                  photo.height,
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


  const startCreateAndUpload = useCallback(
    async (
      metadata: CreatePhotoSessionMetadata,
    ) => {
      const selected = photos;

      if (selected.length === 0) {
        throw new Error(
          'Choose at least one photo.',
        );
      }

      setBusy(true);
      setErrorText('');

      try {
        const created =
          await createUploadSession(
            {
              sessionKind: 'create',
              ...metadata,
              files: selected.map(
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
                    photo.file.type
                      .toLowerCase(),
                  sizeBytes:
                    photo.file.size,
                  width:
                    photo.width,
                  height:
                    photo.height,
                  originalSortOrder,
                  targetVisibility:
                    photo.targetVisibility,
                }),
              ),
            },
            getToken,
          );

        const bound = attachSession(
          selected,
          created,
        );

        return await uploadBoundSession(
          created,
          bound,
        );
      } catch (error) {
        setErrorText(
          error instanceof Error
            ? error.message
            : 'The photo Session could not be created.',
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
      uploadBoundSession,
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
                  width:
                    photo.width,
                  height:
                    photo.height,
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


  const startAppendAndUpload = useCallback(
    async (memoryId: string) => {
      const selected = photos;

      if (selected.length === 0) {
        throw new Error(
          'Choose at least one photo.',
        );
      }

      setBusy(true);
      setErrorText('');

      try {
        const created =
          await createUploadSession(
            {
              sessionKind: 'append',
              memoryId,
              files: selected.map(
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
                    photo.file.type
                      .toLowerCase(),
                  sizeBytes:
                    photo.file.size,
                  width:
                    photo.width,
                  height:
                    photo.height,
                  originalSortOrder,
                  targetVisibility:
                    photo.targetVisibility,
                }),
              ),
            },
            getToken,
          );

        const bound = attachSession(
          selected,
          created,
        );

        return await uploadBoundSession(
          created,
          bound,
        );
      } catch (error) {
        setErrorText(
          error instanceof Error
            ? error.message
            : 'The photo addition could not be created.',
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
      uploadBoundSession,
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
        const normalizedFiles =
          await normalizeSelectedMediaFiles(
            files,
          );
        const mode =
          classifySelection(
            normalizedFiles,
          );

        if (mode.mode !== 'photo-session') {
          throw new Error(
            'Only photos can resume this Session.',
          );
        }

        const prepared =
          await preparePhotoMetadata(
            normalizedFiles,
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

        if (!hasCompleteUploadSessionMatch(match)) {
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


  const resumeAndUpload = useCallback(
    async (
      sessionId: string,
      files: File[],
    ) => {
      setBusy(true);
      setErrorText('');

      const selectedWithPreviews:
        SelectedPhoto[] = [];

      try {
        const normalizedFiles =
          await normalizeSelectedMediaFiles(
            files,
          );
        const mode =
          classifySelection(
            normalizedFiles,
          );

        if (mode.mode !== 'photo-session') {
          throw new Error(
            'Only photos can resume this Session.',
          );
        }

        const prepared =
          await preparePhotoMetadata(
            normalizedFiles,
            getHasher(),
          );

        selectedWithPreviews.push(
          ...prepared.map((photo) => ({
            ...photo,
            previewUrl:
              URL.createObjectURL(
                photo.file,
              ),
            sessionFileId: null,
            status: 'pending' as const,
            allowDuplicate: false,
            message: '',
          })),
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
              files:
                selectedWithPreviews.map(
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

        if (!hasCompleteUploadSessionMatch(match)) {
          throw new Error(
            'Reselect every original photo from this upload Session.',
          );
        }

        const bound = attachSession(
          selectedWithPreviews,
          nextSession,
        );

        return await uploadBoundSession(
          nextSession,
          bound,
        );
      } catch (error) {
        const retainedUrls = new Set(
          photosRef.current.map(
            (photo) => photo.previewUrl,
          ),
        );

        for (
          const photo
          of selectedWithPreviews
        ) {
          if (
            !retainedUrls.has(
              photo.previewUrl,
            )
          ) {
            URL.revokeObjectURL(
              photo.previewUrl,
            );
          }
        }

        setErrorText(
          error instanceof Error
            ? error.message
            : 'The photo Session could not be resumed.',
        );

        throw error;
      } finally {
        setBusy(false);
        setProgressText('');
      }
    },
    [
      attachSession,
      getHasher,
      getToken,
      uploadBoundSession,
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

  const adoptServerSession = useCallback(
    (
      nextSession:
        UploadSession,
    ) => {
      const current =
        photosRef.current;

      if (
        current.length === 0
      ) {
        setSession(
          nextSession,
        );
        return;
      }

      const belongsToSession =
        current.every(
          (photo) =>
            photo.sessionFileId
            !== null
            && nextSession.files
              .some(
                (file) =>
                  file.id
                  === photo
                    .sessionFileId,
              ),
        );

      if (
        !belongsToSession
      ) {
        return;
      }

      replacePhotos(
        bindSelectedPhotos(
          current,
          nextSession,
        ),
      );

      setSession(
        nextSession,
      );
    },
    [replacePhotos],
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
    startCreateAndUpload,
    startAppend,
    startAppendAndUpload,
    resume,
    resumeAndUpload,
    uploadPending,
    adoptServerSession,
    setVisibility,
    keepDuplicate,
    removePhoto,
    reset,
  };
}


export function bindSelectedPhotos(
  selected: SelectedPhoto[],
  session: UploadSession,
): SelectedPhoto[] {
  const bound =
    bindLocalPhotosToSession(
      selected,
      session,
    );

  const selectedByLocalId =
    new Map(
      selected.map((photo) => [
        photo.localId,
        photo,
      ]),
    );

  return bound.map((photo) => {
    const existing =
      selectedByLocalId.get(
        photo.localId,
      );

    if (!existing) {
      throw new Error(
        `${photo.file.name} lost its local preview.`,
      );
    }

    return {
      ...photo,
      previewUrl:
        existing.previewUrl,
      message:
        existing.message,
    };
  });
}

export function toSessionUploadPhotos(
  selected: SelectedPhoto[],
): SessionUploadPhoto[] {
  return selected
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
        statusForUpload(
          photo.status,
        ),
    }));
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
