import {
  useAuth,
} from '@clerk/react';
import {
  useQueryClient,
} from '@tanstack/react-query';
import {
  ArrowLeft,
  ImagePlus,
  LockKeyhole,
} from 'lucide-react';
import {
  useState,
} from 'react';
import {
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom';
import type {
  Memory,
  UploadSessionSummary,
} from '../../shared/contracts';
import {
  ActiveUploadSessions,
} from '../components/upload/ActiveUploadSessions';
import {
  PhotoSelectionPanel,
} from '../components/upload/PhotoSelectionPanel';
import {
  usePhotoSessionUploadContext,
} from '../contexts/PhotoSessionUploadContext';
import {
  activeAppendSessionForMemory,
  uploadSessionsQueryKey,
  useUploadSessions,
} from '../hooks/useUploadSessions';
import {
  useTranslation,
} from '../i18n/useTranslation';
import {
  abandonUploadSession,
  ApiRequestError,
} from '../lib/api';

export interface AddPhotosPageProps {
  memories: Memory[];
  isLoading: boolean;
  isOwner: boolean;
}

export function addPhotosPageMode(
  activeSession:
    UploadSessionSummary | null,
): 'recover' | 'select' {
  return activeSession
    ? 'recover'
    : 'select';
}

export function AddPhotosPage({
  memories,
  isLoading,
  isOwner,
}: AddPhotosPageProps) {
  const {
    memoryId,
  } = useParams();

  const {
    getToken,
  } = useAuth();

  const queryClient =
    useQueryClient();

  const navigate =
    useNavigate();

  const {
    t,
  } = useTranslation();

  const photoWorkflow =
    usePhotoSessionUploadContext();

  const uploadSessions =
    useUploadSessions(isOwner);

  const [
    busySessionId,
    setBusySessionId,
  ] = useState<
    string | null
  >(null);

  const [
    error,
    setError,
  ] = useState('');

  const memory =
    memories.find(
      (candidate) =>
        candidate.id === memoryId,
    );

  const activeAppend =
    memory
      ? activeAppendSessionForMemory(
          uploadSessions.data
            ?? [],
          memory.id,
        )
      : null;

  const mode =
    addPhotosPageMode(
      activeAppend,
    );

  const pageBusy =
    photoWorkflow.busy
    || busySessionId !== null;

  async function selectPhotos(
    files: File[],
  ) {
    setError('');

    try {
      await photoWorkflow
        .selectPhotos(files);
    } catch (
      selectionError
    ) {
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

  async function startAppend() {
    if (!memory) {
      return;
    }

    if (
      photoWorkflow
        .photos.length === 0
    ) {
      setError(
        t(
          'studio.chooseAtLeastOne',
        ),
      );
      return;
    }

    setError('');

    try {
      const session =
        await photoWorkflow
          .startAppendAndUpload(
            memory.id,
          );

      await queryClient
        .invalidateQueries({
          queryKey:
            uploadSessionsQueryKey,
        });

      navigate(
        `/upload-sessions/${session.id}/review`,
      );
    } catch (
      startError
    ) {
      if (
        startError
          instanceof ApiRequestError
        && startError.status
          === 409
      ) {
        await queryClient
          .invalidateQueries({
            queryKey:
              uploadSessionsQueryKey,
          });
      }

      setError(
        startError
          instanceof Error
          ? startError.message
          : t(
              'upload.addPhotosFailed',
            ),
      );
    }
  }

  async function abandon(
    session:
      UploadSessionSummary,
  ) {
    if (
      !window.confirm(
        t(
          'upload.abandonConfirm',
        ),
      )
    ) {
      return;
    }

    setBusySessionId(
      session.id,
    );
    setError('');

    try {
      await abandonUploadSession(
        session.id,
        getToken,
      );

      if (
        photoWorkflow
          .session?.id
        === session.id
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
              'upload.abandonFailed',
            ),
      );
    } finally {
      setBusySessionId(
        null,
      );
    }
  }

  if (isLoading) {
    return (
      <main className="detail-status">
        <p aria-live="polite">
          {t('detail.loading')}
        </p>
      </main>
    );
  }

  if (!isOwner) {
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
      </main>
    );
  }

  if (!memory) {
    return (
      <main className="detail-status">
        <h1>
          {t(
            'detail.unavailableTitle',
          )}
        </h1>
        <p>
          {t(
            'detail.unavailableText',
          )}
        </p>
        <Link
          className="text-link"
          to="/gallery"
        >
          <ArrowLeft size={16} />
          {t('detail.back')}
        </Link>
      </main>
    );
  }

  return (
    <main className="add-photos-page">
      <Link
        className="detail-back"
        to={`/memory/${memory.id}`}
      >
        <ArrowLeft size={16} />
        {t(
          'upload.backToMemory',
        )}
      </Link>

      <header className="studio-intro">
        <p>
          {memory.title}
        </p>
        <h1>
          {t(
            'upload.addPhotosTitle',
          )}
        </h1>
        <em>
          {t(
            'upload.addPhotosSubtitle',
          )}
        </em>
      </header>

      {error ? (
        <div
          className="form-message error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {uploadSessions.error ? (
        <div
          className="form-message error"
          role="alert"
        >
          {
            uploadSessions.error
              .message
          }
        </div>
      ) : null}

      {mode === 'recover'
      && activeAppend ? (
        <ActiveUploadSessions
          sessions={[
            activeAppend,
          ]}
          busySessionId={
            busySessionId
          }
          untitledLabel={
            memory.title
          }
          uploadingLabel={
            t(
              'upload.uploading',
            )
          }
          reviewLabel={
            t(
              'upload.readyToReview',
            )
          }
          resumeLabel={
            t(
              'upload.resume',
            )
          }
          openReviewLabel={
            t(
              'upload.openReview',
            )
          }
          abandonLabel={
            t(
              'upload.abandon',
            )
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
            void abandon(
              session,
            )
          }
        />
      ) : (
        <section className="form-panel add-photos-shell">
          <PhotoSelectionPanel
            photos={
              photoWorkflow.photos
            }
            busy={pageBusy}
            chooseLabel={
              t(
                'upload.choosePhotos',
              )
            }
            browseLabel={
              t('studio.browse')
            }
            formatsLabel={
              t(
                'upload.photoFormats',
              )
            }
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
            onSelect={(files) =>
              void selectPhotos(
                files,
              )
            }
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

          {photoWorkflow
            .progressText ? (
              <div
                className="form-message"
                aria-live="polite"
              >
                {
                  photoWorkflow
                    .progressText
                }
              </div>
            ) : null}

          <div className="form-actions">
            <button
              type="button"
              className="quiet-button"
              disabled={pageBusy}
              onClick={() => {
                photoWorkflow.reset();
                setError('');
              }}
            >
              {t('studio.cancel')}
            </button>

            <button
              type="button"
              className="primary-button"
              disabled={
                pageBusy
                || photoWorkflow
                  .photos.length
                  === 0
              }
              onClick={() =>
                void startAppend()
              }
            >
              <ImagePlus
                size={16}
              />
              {t(
                'upload.startAddPhotos',
              )}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}