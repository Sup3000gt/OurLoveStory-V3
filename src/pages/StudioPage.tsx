import {
  SignInButton,
  useAuth,
} from '@clerk/react';
import {
  useQueryClient,
} from '@tanstack/react-query';
import {
  CalendarDays,
  CloudUpload,
  Globe2,
  Heart,
  ImagePlus,
  LockKeyhole,
  MapPin,
  Save,
  Send,
  Star,
  Trash2,
} from 'lucide-react';
import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  useNavigate,
} from 'react-router-dom';
import {
  MEMORY_CATEGORIES,
  type AuthorizedUpload,
  type CreateMemoryRequest,
  type MemoryStatus,
  type Visibility,
} from '../../shared/contracts';
import {
  ActiveUploadSessions,
} from '../components/upload/ActiveUploadSessions';
import {
  PhotoPreviewGrid,
} from '../components/upload/PhotoPreviewGrid';
import {
  usePhotoSessionUploadContext,
} from '../contexts/PhotoSessionUploadContext';
import {
  activeCreateSessions,
  uploadSessionsQueryKey,
  useUploadSessions,
} from '../hooks/useUploadSessions';
import {
  categoryTranslationKeys,
  type TranslationKey,
  type TranslationValues,
} from '../i18n/translations';
import {
  useTranslation,
} from '../i18n/useTranslation';
import {
  abandonUploadSession,
  authorizeUploads,
  createMemory,
  DirectUploadError,
  uploadFileDirectly,
} from '../lib/api';
import {
  classifySelection,
} from '../lib/photo-file';
import {
  formatMemoryDate,
} from '../lib/format';
import {
  ReliableUploadAuthorizationError,
  ReliableUploadBatchError,
  uploadBatchReliably,
  type ReliableUploadEvent,
} from '../lib/reliable-upload';

const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

const MAX_IMAGE_BYTES =
  50 * 1024 * 1024;

const MAX_VIDEO_BYTES =
  2 * 1024 * 1024 * 1024;

interface MemoryDraft {
  title: string;
  location: string;
  date: string;
  category:
    (typeof MEMORY_CATEGORIES)[number];
  description: string;
  featured: boolean;
}

type SelectedUploadState =
  | 'idle'
  | 'uploading'
  | 'uploaded'
  | 'failed';

interface SelectedMedia {
  id: string;
  file: File;
  previewUrl: string;
  visibility: Visibility;
  upload?: AuthorizedUpload;
  uploadState:
    SelectedUploadState;
  uploadMessage: string;
}

export type StudioSelectionMode =
  | 'none'
  | 'photo-session'
  | 'legacy-media';

const initialDraft: MemoryDraft = {
  title: '',
  location: '',
  date:
    new Date()
      .toISOString()
      .slice(0, 10),
  category: 'Travel',
  description: '',
  featured: false,
};

interface StudioPageProps {
  isOwner: boolean;
  ownerCheckLoading: boolean;
  ownerCheckError: Error | null;
}

type Translator = (
  key: TranslationKey,
  values?: TranslationValues,
) => string;

export function chooseStudioSelectionMode(
  files: File[],
): Exclude<
  StudioSelectionMode,
  'none'
> {
  return classifySelection(files).mode;
}

export function StudioPage({
  isOwner,
  ownerCheckLoading,
  ownerCheckError,
}: StudioPageProps) {
  const {
    isLoaded,
    isSignedIn,
    getToken,
  } = useAuth();

  const queryClient =
    useQueryClient();

  const navigate =
    useNavigate();

  const {
    language,
    t,
  } = useTranslation();

  const photoWorkflow =
    usePhotoSessionUploadContext();

  const uploadSessions =
    useUploadSessions(isOwner);

  const activeCreates =
    activeCreateSessions(
      uploadSessions.data ?? [],
    );

  const [
    draft,
    setDraft,
  ] = useState<MemoryDraft>(
    initialDraft,
  );

  const [
    files,
    setFiles,
  ] = useState<
    SelectedMedia[]
  >([]);

  const [
    selectionMode,
    setSelectionMode,
  ] = useState<
    StudioSelectionMode
  >('none');

  const [
    coverId,
    setCoverId,
  ] = useState<
    string | null
  >(null);

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    abandoningSessionId,
    setAbandoningSessionId,
  ] = useState<
    string | null
  >(null);

  const [
    progress,
    setProgress,
  ] = useState('');

  const [
    error,
    setError,
  ] = useState('');

  const fileRef =
    useRef<
      SelectedMedia[]
    >([]);

  useEffect(() => {
    fileRef.current = files;
  }, [files]);

  useEffect(
    () => () => {
      fileRef.current.forEach(
        (item) =>
          URL.revokeObjectURL(
            item.previewUrl,
          ),
      );
    },
    [],
  );

  const legacyCover =
    useMemo(
      () =>
        files.find(
          (item) =>
            item.id === coverId,
        )
        ?? files[0]
        ?? null,
      [
        coverId,
        files,
      ],
    );

  const photoCover =
    photoWorkflow.photos.find(
      (photo) =>
        photo.status
          !== 'duplicate'
        && photo.status
          !== 'skipped',
    ) ?? null;

  const pageBusy =
    busy
    || photoWorkflow.busy
    || abandoningSessionId
      !== null;

  const combinedError =
    error
    || photoWorkflow.errorText;

  const combinedProgress =
    progress
    || photoWorkflow.progressText;

  const hasPublicMedia =
    selectionMode
      === 'photo-session'
      ? photoWorkflow.photos.some(
          (photo) =>
            photo.status
              !== 'duplicate'
            && photo.status
              !== 'skipped'
            && photo
              .targetVisibility
              === 'public',
        )
      : files.some(
          (item) =>
            item.visibility
              === 'public',
        );

  if (
    !isLoaded
    || ownerCheckLoading
  ) {
    return (
      <main className="login-required">
        <p>
          {t('studio.checking')}
        </p>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="login-required">
        <LockKeyhole size={40} />
        <h1>
          {t(
            'studio.ownerOnlyTitle',
          )}
        </h1>
        <p>
          {t(
            'studio.ownerOnlyText',
          )}
        </p>

        <SignInButton mode="modal">
          <button
            className="primary-button"
            type="button"
          >
            {t(
              'studio.ownerLogin',
            )}
          </button>
        </SignInButton>
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="login-required">
        <LockKeyhole size={40} />
        <h1>
          {t(
            'studio.notOwnerTitle',
          )}
        </h1>
        <p>
          {ownerCheckError
            ? t(
                'studio.notOwnerText',
              )
            : t(
                'studio.notOwnerText',
              )}
        </p>
      </main>
    );
  }

  async function selectFiles(
    selectedFiles: File[],
  ) {
    if (
      selectedFiles.length
      === 0
    ) {
      return;
    }

    setError('');

    try {
      const mode =
        chooseStudioSelectionMode(
          selectedFiles,
        );

      if (
        mode
        === 'photo-session'
      ) {
        files.forEach(
          (item) =>
            URL.revokeObjectURL(
              item.previewUrl,
            ),
        );

        setFiles([]);
        setCoverId(null);

        await photoWorkflow
          .selectPhotos(
            selectedFiles,
          );

        setSelectionMode(
          'photo-session',
        );

        return;
      }

      validateSelectedFiles(
        selectedFiles,
        t,
      );

      photoWorkflow.reset();

      files.forEach(
        (item) =>
          URL.revokeObjectURL(
            item.previewUrl,
          ),
      );

      const next =
        createLegacySelectedMedia(
          selectedFiles,
        );

      setFiles(next);
      setCoverId(
        next[0]?.id ?? null,
      );
      setSelectionMode(
        'legacy-media',
      );
    } catch (selectionError) {
      setError(
        selectionError
          instanceof Error
          ? selectionError.message
          : t(
              'studio.invalidSelection',
            ),
      );
    }
  }

  function removeLegacyFile(
    id: string,
  ) {
    const removed =
      files.find(
        (item) =>
          item.id === id,
      );

    if (removed) {
      URL.revokeObjectURL(
        removed.previewUrl,
      );
    }

    const next =
      files.filter(
        (item) =>
          item.id !== id,
      );

    setFiles(next);

    if (coverId === id) {
      setCoverId(
        next[0]?.id
        ?? null,
      );
    }

    if (next.length === 0) {
      setSelectionMode('none');
    }
  }

  function toggleLegacyVisibility(
    id: string,
  ) {
    setFiles((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              visibility:
                item.visibility
                  === 'public'
                  ? 'private'
                  : 'public',
            }
          : item,
      ),
    );
  }

  function resetForm() {
    files.forEach(
      (item) =>
        URL.revokeObjectURL(
          item.previewUrl,
        ),
    );

    setFiles([]);
    setCoverId(null);
    setSelectionMode('none');
    photoWorkflow.reset();
    setDraft(initialDraft);
    setError('');
    setProgress('');
  }

  async function savePhotoMemory(
    status: MemoryStatus,
  ) {
    setError('');

    if (
      !draft.title.trim()
      || !draft.location.trim()
      || !draft.date
    ) {
      setError(
        t(
          'studio.requiredFields',
        ),
      );
      return;
    }

    if (
      photoWorkflow.photos.length
      === 0
    ) {
      setError(
        t(
          'studio.chooseAtLeastOne',
        ),
      );
      return;
    }

    setBusy(true);

    try {
      setProgress(
        t('studio.preparing'),
      );

      const finalSession =
        await photoWorkflow
          .startCreateAndUpload({
            title:
              draft.title.trim(),
            location:
              draft.location.trim(),
            date: draft.date,
            category:
              draft.category,
            description:
              draft.description,
            featured:
              draft.featured,
            targetMemoryStatus:
              status,
          });

      await queryClient
        .invalidateQueries({
          queryKey:
            uploadSessionsQueryKey,
        });

      navigate(
        `/upload-sessions/${finalSession.id}/review`,
      );
    } catch (submissionError) {
      setError(
        submissionError
          instanceof Error
          ? submissionError.message
          : t(
              'studio.saveError',
            ),
      );
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  async function saveLegacyMemory(
    status: MemoryStatus,
  ) {
    setError('');

    if (
      !draft.title.trim()
      || !draft.location.trim()
      || !draft.date
    ) {
      setError(
        t(
          'studio.requiredFields',
        ),
      );
      return;
    }

    if (
      !legacyCover
      || files.length === 0
    ) {
      setError(
        t(
          'studio.chooseAtLeastOne',
        ),
      );
      return;
    }

    setBusy(true);

    try {
      setProgress(
        t('studio.preparing'),
      );

      const uploadsById =
        await uploadBatchReliably<
          File,
          AuthorizedUpload
        >({
          items:
            files.map(
              (item) => ({
                id: item.id,
                file: item.file,
                completedUpload:
                  item.uploadState
                    === 'uploaded'
                    ? item.upload
                    : undefined,
              }),
            ),

          authorize:
            async (
              selectedFiles,
            ) =>
              (
                await authorizeUploads(
                  selectedFiles,
                  getToken,
                )
              ).uploads,

          upload:
            async (
              upload,
              file,
            ) =>
              uploadFileDirectly(
                upload.uploadUrl,
                upload.headers,
                file,
              ),

          shouldReauthorize:
            (
              uploadError,
            ) =>
              uploadError
                instanceof
                  DirectUploadError
              && (
                uploadError.status
                  === 401
                || uploadError.status
                  === 403
              ),

          getFileName:
            (file) =>
              file.name,

          concurrency: 3,
          maxRetries: 3,

          onEvent:
            (event) =>
              updateSelectedUpload(
                event,
              ),
        });

      const orderedUploads =
        files.map(
          (item) =>
            uploadsById.get(
              item.id,
            ),
        );

      if (
        orderedUploads.some(
          (upload) =>
            !upload,
        )
      ) {
        throw new Error(
          'One or more completed uploads could not be matched.',
        );
      }

      const coverUpload =
        uploadsById.get(
          legacyCover.id,
        );

      if (!coverUpload) {
        throw new Error(
          'Cover upload mismatch.',
        );
      }

      const request:
        CreateMemoryRequest = {
          title: draft.title,
          location:
            draft.location,
          date: draft.date,
          category:
            draft.category,
          description:
            draft.description,
          visibility: 'private',
          featured:
            draft.featured,
          status,
          coverObjectKey:
            coverUpload.objectKey,
          assets:
            orderedUploads.map(
              (
                upload,
                index,
              ) => ({
                objectKey:
                  upload!.objectKey,
                originalFilename:
                  upload!
                    .originalFilename,
                mimeType:
                  files[index]!
                    .file.type,
                sizeBytes:
                  upload!.sizeBytes,
                mediaType:
                  upload!.mediaType,
                sortOrder: index,
                visibility:
                  files[index]!
                    .visibility,
              }),
            ),
        };

      setProgress(
        status === 'draft'
          ? t(
              'studio.savingDraft',
            )
          : t(
              'studio.publishing',
            ),
      );

      const memory =
        await createMemory(
          request,
          getToken,
        );

      await queryClient
        .invalidateQueries({
          queryKey: [
            'memories',
          ],
        });

      resetForm();

      navigate(
        status === 'published'
          ? `/memory/${memory.id}`
          : '/gallery',
      );
    } catch (submissionError) {
      if (
        submissionError
          instanceof
            ReliableUploadBatchError
      ) {
        setError(
          t(
            'studio.fileUploadFailed',
            {
              filename:
                submissionError
                  .filename,
              reason:
                describeUploadFailure(
                  submissionError
                    .originalError,
                  t,
                ),
            },
          ),
        );
      } else if (
        submissionError
          instanceof
            ReliableUploadAuthorizationError
      ) {
        setError(
          t(
            'studio.prepareUploadFailed',
          ),
        );
      } else {
        setError(
          t(
            'studio.saveError',
          ),
        );
      }
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  async function saveMemory(
    status: MemoryStatus,
  ) {
    if (
      selectionMode
      === 'photo-session'
    ) {
      await savePhotoMemory(
        status,
      );
      return;
    }

    if (
      selectionMode
      === 'legacy-media'
    ) {
      await saveLegacyMemory(
        status,
      );
      return;
    }

    setError(
      t(
        'studio.chooseAtLeastOne',
      ),
    );
  }

  async function abandonCreateSession(
    sessionId: string,
  ) {
    if (
      !window.confirm(
        t('upload.abandon'),
      )
    ) {
      return;
    }

    setAbandoningSessionId(
      sessionId,
    );
    setError('');

    try {
      await abandonUploadSession(
        sessionId,
        getToken,
      );

      if (
        photoWorkflow.session?.id
        === sessionId
      ) {
        photoWorkflow.reset();
      }

      await queryClient
        .invalidateQueries({
          queryKey:
            uploadSessionsQueryKey,
        });
    } catch (
      abandonError
    ) {
      setError(
        abandonError
          instanceof Error
          ? abandonError.message
          : t(
              'studio.saveError',
            ),
      );
    } finally {
      setAbandoningSessionId(
        null,
      );
    }
  }

  function updateSelectedUpload(
    event:
      ReliableUploadEvent<
        AuthorizedUpload
      >,
  ) {
    const uploadState:
      SelectedUploadState =
        event.state
          === 'uploaded'
          ? 'uploaded'
          : event.state
              === 'failed'
            ? 'failed'
            : 'uploading';

    const uploadMessage =
      event.state
        === 'uploaded'
        ? t(
            'studio.uploaded',
          )
        : event.state
            === 'failed'
          ? t(
              'studio.uploadFailedShort',
            )
          : event.state
              === 'retrying'
            ? t(
                'studio.retryingUpload',
                {
                  filename:
                    event.filename,
                  retry:
                    event.retry,
                  maxRetries:
                    event.maxRetries,
                },
              )
            : t(
                'studio.uploadingShort',
              );

    setFiles((current) =>
      current.map((item) =>
        item.id === event.id
          ? {
              ...item,
              upload:
                event.upload
                ?? item.upload,
              uploadState,
              uploadMessage,
            }
          : item,
      ),
    );

    if (
      event.state
      === 'retrying'
    ) {
      setProgress(
        t(
          'studio.retryingUpload',
          {
            filename:
              event.filename,
            retry:
              event.retry,
            maxRetries:
              event.maxRetries,
          },
        ),
      );
    } else if (
      event.state
        === 'uploading'
      || event.state
        === 'uploaded'
    ) {
      setProgress(
        t(
          'studio.uploadProgress',
          {
            filename:
              event.filename,
            completed:
              event.completed,
            total:
              event.total,
          },
        ),
      );
    }
  }

  function submit(
    event: FormEvent,
  ) {
    event.preventDefault();
    void saveMemory(
      'published',
    );
  }

  return (
    <main className="studio-page">
      <header className="studio-intro">
        <p>
          {t('studio.eyebrow')}
        </p>
        <h1>
          {t('studio.title')}
        </h1>
        <em>
          {t('studio.subtitle')}
        </em>
      </header>

      <ActiveUploadSessions
        sessions={activeCreates}
        busySessionId={
          abandoningSessionId
        }
        untitledLabel={
          t('upload.untitled')
        }
        uploadingLabel={
          t('upload.uploading')
        }
        reviewLabel={
          t(
            'upload.readyToReview',
          )
        }
        resumeLabel={
          t('upload.resume')
        }
        openReviewLabel={
          t('upload.openReview')
        }
        abandonLabel={
          t('upload.abandon')
        }
        progressLabel={
          (value) => value
        }
        onOpen={(session) =>
          navigate(
            `/upload-sessions/${session.id}/review`,
          )
        }
        onAbandon={(session) =>
          void abandonCreateSession(
            session.id,
          )
        }
      />

      <form
        className="studio-layout"
        onSubmit={submit}
      >
        <section className="form-panel">
          <label className="field-label">
            {t(
              'studio.uploadStep',
            )}
          </label>

          <label className="dropzone">
            <CloudUpload size={38} />
            <strong>
              {t(
                'studio.chooseMedia',
              )}
            </strong>
            <span>
              {t('studio.browse')}
            </span>
            <small>
              {t('studio.formats')}
            </small>

            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
              disabled={pageBusy}
              onChange={(event) => {
                const selected =
                  Array.from(
                    event.target.files
                    ?? [],
                  );

                event.target.value =
                  '';

                void selectFiles(
                  selected,
                );
              }}
            />
          </label>

          {selectionMode
            === 'photo-session'
            && photoWorkflow
              .photos.length
              > 0 ? (
                <PhotoPreviewGrid
                  photos={
                    photoWorkflow
                      .photos
                  }
                  disabled={pageBusy}
                  labels={{
                    selected:
                      t(
                        'upload.selected',
                      ),
                    uploaded:
                      t(
                        'studio.uploaded',
                      ),
                    duplicate:
                      t(
                        'upload.duplicate',
                      ),
                    public:
                      t(
                        'studio.public',
                      ),
                    private:
                      t(
                        'studio.private',
                      ),
                    keepDuplicate:
                      t(
                        'upload.keepDuplicate',
                      ),
                    remove:
                      t(
                        'upload.remove',
                      ),
                  }}
                  onVisibility={(
                    localId,
                    visibility,
                  ) =>
                    void photoWorkflow
                      .setVisibility(
                        localId,
                        visibility,
                      )
                  }
                  onKeepDuplicate={(
                    localId,
                  ) =>
                    void photoWorkflow
                      .keepDuplicate(
                        localId,
                      )
                  }
                  onRemove={(
                    localId,
                  ) =>
                    void photoWorkflow
                      .removePhoto(
                        localId,
                      )
                  }
                />
              ) : selectionMode
                  === 'legacy-media'
                && files.length
                  > 0 ? (
                    <div className="upload-strip upload-preview-strip">
                      {files.map(
                        (item) => (
                          <article
                            className={
                              `upload-preview ${
                                coverId
                                  === item.id
                                  ? 'cover'
                                  : ''
                              }`
                            }
                            key={
                              item.id
                            }
                          >
                            <div className="upload-preview-media">
                              {item.file.type
                                .startsWith(
                                  'video/',
                                ) ? (
                                  <video
                                    src={
                                      item.previewUrl
                                    }
                                    muted
                                    playsInline
                                  />
                                ) : (
                                  <img
                                    src={
                                      item.previewUrl
                                    }
                                    alt={
                                      item.file.name
                                    }
                                  />
                                )}
                            </div>

                            <button
                              className="cover-button"
                              type="button"
                              onClick={() =>
                                setCoverId(
                                  item.id,
                                )
                              }
                              aria-label={
                                `${t(
                                  'studio.setCover',
                                )}: ${
                                  item.file.name
                                }`
                              }
                              disabled={
                                pageBusy
                              }
                            >
                              <Star
                                size={13}
                                fill={
                                  coverId
                                    === item.id
                                    ? 'currentColor'
                                    : 'none'
                                }
                              />
                              {coverId
                                === item.id
                                ? t(
                                    'studio.cover',
                                  )
                                : t(
                                    'studio.setCover',
                                  )}
                            </button>

                            <button
                              className={
                                `upload-visibility-button ${
                                  item.visibility
                                }`
                              }
                              type="button"
                              onClick={() =>
                                toggleLegacyVisibility(
                                  item.id,
                                )
                              }
                              aria-pressed={
                                item.visibility
                                  === 'public'
                              }
                              disabled={
                                pageBusy
                              }
                            >
                              {item.visibility
                                === 'public'
                                ? (
                                    <Globe2
                                      size={13}
                                    />
                                  )
                                : (
                                    <LockKeyhole
                                      size={13}
                                    />
                                  )}
                              {item.visibility
                                === 'public'
                                ? t(
                                    'studio.public',
                                  )
                                : t(
                                    'studio.private',
                                  )}
                            </button>

                            <button
                              className="remove-file-button"
                              type="button"
                              onClick={() =>
                                removeLegacyFile(
                                  item.id,
                                )
                              }
                              aria-label={
                                t(
                                  'studio.remove',
                                  {
                                    filename:
                                      item.file.name,
                                  },
                                )
                              }
                              disabled={
                                pageBusy
                              }
                            >
                              <Trash2
                                size={14}
                              />
                            </button>

                            <small>
                              {item.file.name}
                              <br />
                              {formatBytes(
                                item.file.size,
                              )}
                            </small>

                            {item.uploadState
                              !== 'idle' ? (
                                <span
                                  className={
                                    `selected-upload-state ${
                                      item.uploadState
                                    }`
                                  }
                                >
                                  {item.uploadMessage}
                                </span>
                              ) : null}
                          </article>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="upload-empty-hint">
                      <ImagePlus
                        size={18}
                      />
                      {t(
                        'studio.selectedEmpty',
                      )}
                    </div>
                  )}

          <div className="fields-grid">
            <label>
              <span>
                {t(
                  'studio.titleField',
                )}
              </span>
              <input
                required
                maxLength={120}
                value={
                  draft.title
                }
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    title:
                      event.target
                        .value,
                  })
                }
              />
            </label>

            <label>
              <span>
                {t(
                  'studio.locationField',
                )}
              </span>
              <div className="input-icon">
                <MapPin size={16} />
                <input
                  required
                  maxLength={160}
                  value={
                    draft.location
                  }
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      location:
                        event.target
                          .value,
                    })
                  }
                />
              </div>
            </label>

            <label>
              <span>
                {t(
                  'studio.dateField',
                )}
              </span>
              <div className="input-icon">
                <CalendarDays
                  size={16}
                />
                <input
                  required
                  type="date"
                  value={
                    draft.date
                  }
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      date:
                        event.target
                          .value,
                    })
                  }
                />
              </div>
            </label>

            <label>
              <span>
                {t(
                  'studio.categoryField',
                )}
              </span>
              <select
                value={
                  draft.category
                }
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    category:
                      (event.target.value as MemoryDraft['category']),
                  })
                }
              >
                {MEMORY_CATEGORIES
                  .map(
                    (category) => (
                      <option
                        key={
                          category
                        }
                        value={
                          category
                        }
                      >
                        {t(
                          categoryTranslationKeys[
                            category
                          ],
                        )}
                      </option>
                    ),
                  )}
              </select>
            </label>
          </div>

          <label className="full-field">
            <span>
              {t(
                'studio.descriptionField',
              )}
            </span>
            <textarea
              maxLength={600}
              value={
                draft.description
              }
              onChange={(event) =>
                setDraft({
                  ...draft,
                  description:
                    event.target
                      .value,
                })
              }
            />
            <small>
              {draft.description
                .length}/600
            </small>
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              checked={
                draft.featured
              }
              onChange={(event) =>
                setDraft({
                  ...draft,
                  featured:
                    event.target
                      .checked,
                })
              }
            />
            <span>
              <strong>
                {t(
                  'studio.highlight',
                )}
              </strong>
              <small>
                {t(
                  'studio.highlightHelp',
                )}
              </small>
            </span>
          </label>

          {hasPublicMedia ? (
            <p className="privacy-warning">
              {t(
                'studio.privacyWarning',
              )}
            </p>
          ) : null}

          {combinedError ? (
            <div
              className="form-message error"
              role="alert"
            >
              {combinedError}
            </div>
          ) : null}

          {combinedProgress ? (
            <div
              className="form-message"
              aria-live="polite"
            >
              {combinedProgress}
            </div>
          ) : null}

          <div className="form-actions">
            <button
              type="button"
              className="quiet-button"
              onClick={resetForm}
              disabled={pageBusy}
            >
              {t(
                'studio.cancel',
              )}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void saveMemory(
                  'draft',
                )
              }
              disabled={pageBusy}
            >
              <Save size={16} />
              {t(
                'studio.saveDraft',
              )}
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={pageBusy}
            >
              <Send size={16} />
              {t(
                'studio.publish',
              )}
              <Heart size={15} />
            </button>
          </div>
        </section>

        <aside className="preview-panel">
          <div className="preview-heading">
            <h2>
              {t(
                'studio.preview',
              )}
            </h2>
            <p>
              {t(
                'studio.previewHelp',
              )}
            </p>
          </div>

          <article className="preview-card">
            <div className="preview-media">
              {selectionMode
                === 'photo-session'
                && photoCover ? (
                  <img
                    src={
                      photoCover
                        .previewUrl
                    }
                    alt={
                      draft.title
                      || t(
                        'studio.untitled',
                      )
                    }
                  />
                ) : legacyCover ? (
                  legacyCover.file.type
                    .startsWith(
                      'video/',
                    )
                    ? (
                        <video
                          src={
                            legacyCover
                              .previewUrl
                          }
                          controls
                        />
                      )
                    : (
                        <img
                          src={
                            legacyCover
                              .previewUrl
                          }
                          alt={
                            draft.title
                            || t(
                              'studio.untitled',
                            )
                          }
                        />
                      )
                ) : (
                  <div className="preview-placeholder">
                    <ImagePlus
                      size={42}
                    />
                    <span>
                      {t(
                        'studio.chooseCover',
                      )}
                    </span>
                  </div>
                )}

              {selectionMode
                === 'photo-session'
                && photoCover ? (
                  <span
                    className={
                      `visibility-badge ${
                        photoCover
                          .targetVisibility
                      }`
                    }
                  >
                    {photoCover
                      .targetVisibility
                      === 'private'
                      ? (
                          <LockKeyhole
                            size={12}
                          />
                        )
                      : (
                          <Globe2
                            size={12}
                          />
                        )}
                    {photoCover
                      .targetVisibility
                      === 'private'
                      ? t(
                          'studio.private',
                        )
                      : t(
                          'studio.public',
                        )}
                  </span>
                ) : legacyCover ? (
                  <span
                    className={
                      `visibility-badge ${
                        legacyCover
                          .visibility
                      }`
                    }
                  >
                    {legacyCover.visibility
                      === 'private'
                      ? (
                          <LockKeyhole
                            size={12}
                          />
                        )
                      : (
                          <Globe2
                            size={12}
                          />
                        )}
                    {legacyCover.visibility
                      === 'private'
                      ? t(
                          'studio.private',
                        )
                      : t(
                          'studio.public',
                        )}
                  </span>
                ) : null}
            </div>

            <div className="preview-copy">
              <h3>
                {draft.title
                  || t(
                    'studio.untitled',
                  )}
              </h3>

              <div>
                <span>
                  <MapPin size={14} />
                  {draft.location
                    || t(
                      'studio.locationPlaceholder',
                    )}
                </span>

                <span>
                  <CalendarDays
                    size={14}
                  />
                  {formatMemoryDate(
                    draft.date,
                    language,
                  )}
                </span>
              </div>

              <p>
                {draft.description
                  || t(
                    'studio.descriptionPlaceholder',
                  )}
              </p>
            </div>
          </article>

          <div className="preview-note">
            {t(
              'studio.previewNote',
            )}
            <br />
            <em>
              {t(
                'studio.previewQuote',
              )}
            </em>
          </div>
        </aside>
      </form>
    </main>
  );
}

function createLegacySelectedMedia(
  files: File[],
): SelectedMedia[] {
  return files.map((file) => ({
    id: crypto.randomUUID(),
    file,
    previewUrl:
      URL.createObjectURL(file),
    visibility: 'private',
    uploadState: 'idle',
    uploadMessage: '',
  }));
}

function validateSelectedFiles(
  selectedFiles: File[],
  t: Translator,
) {
  if (
    selectedFiles.length === 0
  ) {
    throw new Error(
      t(
        'studio.chooseAtLeastOne',
      ),
    );
  }

  if (
    selectedFiles.length > 20
  ) {
    throw new Error(
      t('studio.maxFiles'),
    );
  }

  for (
    const file
    of selectedFiles
  ) {
    if (
      !ACCEPTED_TYPES.has(
        file.type,
      )
    ) {
      throw new Error(
        t(
          'studio.unsupportedType',
          {
            filename:
              file.name,
          },
        ),
      );
    }

    const limit =
      file.type
        .startsWith('image/')
        ? MAX_IMAGE_BYTES
        : MAX_VIDEO_BYTES;

    if (file.size > limit) {
      throw new Error(
        file.type
          .startsWith(
            'image/',
          )
          ? t(
              'studio.imageTooLarge',
              {
                filename:
                  file.name,
              },
            )
          : t(
              'studio.videoTooLarge',
              {
                filename:
                  file.name,
              },
            ),
      );
    }
  }
}

function describeUploadFailure(
  error: unknown,
  t: Translator,
): string {
  if (
    error
    instanceof DirectUploadError
  ) {
    if (
      error.status === 401
      || error.status === 403
    ) {
      return t(
        'studio.uploadLinkExpired',
      );
    }

    if (
      error.status !== null
    ) {
      return t(
        'studio.uploadServerError',
        {
          status:
            error.status,
        },
      );
    }

    return t(
      'studio.uploadNetworkError',
    );
  }

  return t(
    'studio.uploadNetworkError',
  );
}

function formatBytes(
  bytes: number,
): string {
  if (
    bytes
    < 1024 * 1024
  ) {
    return (
      `${Math.max(
        1,
        Math.round(
          bytes / 1024,
        ),
      )} KB`
    );
  }

  if (
    bytes
    < 1024
      * 1024
      * 1024
  ) {
    return (
      `${
        (
          bytes
          / (1024 * 1024)
        ).toFixed(1)
      } MB`
    );
  }

  return (
    `${
      (
        bytes
        / (
          1024
          * 1024
          * 1024
        )
      ).toFixed(1)
    } GB`
  );
}