import {
  useAuth,
} from '@clerk/react';
import {
  useQueryClient,
} from '@tanstack/react-query';
import {
  ArrowLeft,
  LockKeyhole,
  RotateCcw,
  UploadCloud,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom';
import type {
  UploadSession,
  UploadSessionFile,
} from '../../shared/contracts';
import {
  ReviewActions,
} from '../components/upload/ReviewActions';
import {
  SessionProgressBanner,
} from '../components/upload/SessionProgressBanner';
import {
  UploadSessionReviewGrid,
} from '../components/upload/UploadSessionReviewGrid';
import {
  buildSessionPhotoLookup,
  hasLocalSession,
  usePhotoSessionUploadContext,
} from '../contexts/PhotoSessionUploadContext';
import {
  uploadSessionQueryKey,
  useUploadSession,
} from '../hooks/useUploadSession';
import {
  uploadSessionsQueryKey,
} from '../hooks/useUploadSessions';
import type {
  TranslationKey,
  TranslationValues,
} from '../i18n/translations';
import {
  useTranslation,
} from '../i18n/useTranslation';
import {
  abandonUploadSession,
  confirmUploadSession,
  updateUploadSessionReview,
} from '../lib/api';
import {
  sessionThumbnailUrl,
} from '../lib/image-assets';
import {
  buildReviewRequest,
  createReviewDraft,
  getReviewBlockingReason,
  keepReviewDuplicate,
  moveReviewFile,
  setReviewCover,
  setReviewSkipped,
  setReviewVisibility,
  type ReviewBlockingReason,
  type ReviewDraft,
} from '../lib/upload-session-review';

export interface UploadSessionReviewPageProps {
  isOwner: boolean;
}

export type ReviewRecoveryMode =
  | 'review'
  | 'retry'
  | 'reselect';

type BusyAction =
  | 'save'
  | 'confirm'
  | 'abandon'
  | 'reselect'
  | 'retry';

type Translator = (
  key: TranslationKey,
  values?: TranslationValues,
) => string;

export function reviewPreviewUrl(
  sessionId: string,
  fileId: string,
  serverStatus: UploadSessionFile['status'],
  localUrl: string | null,
): string | null {
  if (localUrl) {
    return localUrl;
  }

  return serverStatus === 'uploaded'
    ? sessionThumbnailUrl(
        sessionId,
        fileId,
      )
    : null;
}

export function reviewRecoveryMode(
  session: UploadSession,
  hasLocalFiles: boolean,
): ReviewRecoveryMode {
  if (
    session.status === 'review'
  ) {
    return 'review';
  }

  return hasLocalFiles
    ? 'retry'
    : 'reselect';
}

export function UploadSessionReviewPage({
  isOwner,
}: UploadSessionReviewPageProps) {
  const {
    sessionId,
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

  const sessionQuery =
    useUploadSession(
      sessionId,
      isOwner,
    );

  const [
    draft,
    setDraft,
  ] = useState<
    ReviewDraft | null
  >(null);

  const [
    busyAction,
    setBusyAction,
  ] = useState<
    BusyAction | null
  >(null);

  const [
    error,
    setError,
  ] = useState('');

  const session =
    sessionQuery.data;

  const localSession =
    hasLocalSession(
      photoWorkflow.session,
      sessionId ?? '',
    );

  const localLookup =
    buildSessionPhotoLookup(
      localSession
        ? photoWorkflow.photos
        : [],
    );

  const previewBySessionFileId =
    useMemo(
      () => {
        if (!session) {
          return new Map<string, string>();
        }

        return new Map(
          session.files.map((file) => [
            file.id,
            reviewPreviewUrl(
              session.id,
              file.id,
              file.status,
              localLookup.get(
                file.id,
              )?.previewUrl
                ?? null,
            ),
          ]).filter(
            (
              entry,
            ): entry is [string, string] =>
              entry[1] !== null,
          ),
        );
      },
      [
        session,
        localSession,
        photoWorkflow.photos,
      ],
    );

  const hasLocalFiles =
    localSession
    && photoWorkflow.photos
      .length > 0;

  const recoveryMode =
    session
      ? reviewRecoveryMode(
          session,
          hasLocalFiles,
        )
      : null;

  const busy =
    busyAction !== null
    || photoWorkflow.busy;

  const blocker =
    session
    && draft
      ? getReviewBlockingReason(
          session,
          draft,
        )
      : null;

  const publicIncluded =
    draft?.files.some(
      (file) =>
        !file.skipped
        && file
          .targetVisibility
          === 'public',
    )
    ?? false;

  useEffect(() => {
    const current =
      sessionQuery.data;

    if (!current) {
      return;
    }

    setDraft(
      createReviewDraft(
        current,
      ),
    );

    const noLocalWorkflow =
      photoWorkflow
        .photos.length === 0
      && photoWorkflow
        .session === null;

    const sameLocalWorkflow =
      photoWorkflow
        .session?.id
      === current.id;

    if (
      noLocalWorkflow
      || sameLocalWorkflow
    ) {
      photoWorkflow
        .adoptServerSession(
          current,
        );
    }
  }, [
    sessionQuery.data?.id,
    sessionQuery.data?.updatedAt,
  ]);

  useEffect(() => {
    if (
      session?.status
        === 'completed'
      && session.memoryId
    ) {
      navigate(
        `/memory/${session.memoryId}`,
        {
          replace: true,
        },
      );
    }
  }, [
    navigate,
    session?.memoryId,
    session?.status,
  ]);

  async function persistReview():
    Promise<UploadSession> {
    if (
      !sessionId
      || !draft
    ) {
      throw new Error(
        t(
          'upload.sessionUnavailable',
        ),
      );
    }

    const refreshed =
      await updateUploadSessionReview(
        sessionId,
        buildReviewRequest(
          draft,
        ),
        getToken,
      );

    queryClient.setQueryData(
      uploadSessionQueryKey(
        sessionId,
      ),
      refreshed,
    );

    const mayAdopt =
      photoWorkflow
        .photos.length === 0
      || photoWorkflow
        .session?.id
        === refreshed.id;

    if (mayAdopt) {
      photoWorkflow
        .adoptServerSession(
          refreshed,
        );
    }

    setDraft(
      createReviewDraft(
        refreshed,
      ),
    );

    await queryClient
      .invalidateQueries({
        queryKey:
          uploadSessionsQueryKey,
      });

    return refreshed;
  }

  async function reselectAndResume(
    files: File[],
  ) {
    if (!sessionId) {
      return;
    }

    setBusyAction(
      'reselect',
    );
    setError('');

    try {
      const refreshed =
        await photoWorkflow
          .resumeAndUpload(
            sessionId,
            files,
          );

      queryClient.setQueryData(
        uploadSessionQueryKey(
          sessionId,
        ),
        refreshed,
      );

      setDraft(
        createReviewDraft(
          refreshed,
        ),
      );

      await queryClient
        .invalidateQueries({
          queryKey:
            uploadSessionsQueryKey,
        });
    } catch (
      resumeError
    ) {
      setError(
        resumeError
          instanceof Error
          ? resumeError.message
          : t(
              'upload.reselectFailed',
            ),
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function retryUpload() {
    if (
      !sessionId
      || !localSession
    ) {
      return;
    }

    setBusyAction('retry');
    setError('');

    try {
      const refreshed =
        await photoWorkflow
          .uploadPending();

      queryClient.setQueryData(
        uploadSessionQueryKey(
          sessionId,
        ),
        refreshed,
      );

      setDraft(
        createReviewDraft(
          refreshed,
        ),
      );

      await queryClient
        .invalidateQueries({
          queryKey:
            uploadSessionsQueryKey,
        });
    } catch (
      retryError
    ) {
      setError(
        retryError
          instanceof Error
          ? retryError.message
          : t(
              'upload.retryFailed',
            ),
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function saveReview() {
    setBusyAction('save');
    setError('');

    try {
      await persistReview();
    } catch (
      saveError
    ) {
      setError(
        saveError
          instanceof Error
          ? saveError.message
          : t(
              'upload.reviewSaveFailed',
            ),
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function confirmReview() {
    if (
      !sessionId
      || !session
      || !draft
    ) {
      return;
    }

    const blockingReason =
      getReviewBlockingReason(
        session,
        draft,
      );

    if (blockingReason) {
      setError(
        reviewBlockingMessage(
          blockingReason,
          t,
        ),
      );
      return;
    }

    setBusyAction('confirm');
    setError('');

    try {
      await persistReview();

      const memory =
        await confirmUploadSession(
          sessionId,
          getToken,
        );

      await Promise.all([
        queryClient
          .invalidateQueries({
            queryKey: [
              'memories',
            ],
          }),
        queryClient
          .invalidateQueries({
            queryKey:
              uploadSessionsQueryKey,
          }),
      ]);

      photoWorkflow.reset();

      navigate(
        `/memory/${memory.id}`,
        {
          replace: true,
        },
      );
    } catch (
      confirmError
    ) {
      setError(
        confirmError
          instanceof Error
          ? confirmError.message
          : t(
              'upload.confirmFailed',
            ),
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function abandonReview() {
    if (
      !sessionId
      || !session
    ) {
      return;
    }

    if (
      !window.confirm(
        t(
          'upload.abandonConfirm',
        ),
      )
    ) {
      return;
    }

    setBusyAction('abandon');
    setError('');

    try {
      await abandonUploadSession(
        sessionId,
        getToken,
      );

      await queryClient
        .invalidateQueries({
          queryKey:
            uploadSessionsQueryKey,
        });

      if (
        photoWorkflow
          .session?.id
        === sessionId
      ) {
        photoWorkflow.reset();
      }

      navigate(
        session.kind
          === 'append'
        && session.memoryId
          ? `/memory/${session.memoryId}`
          : '/studio',
        {
          replace: true,
        },
      );
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
      setBusyAction(null);
    }
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

  if (
    sessionQuery.isLoading
  ) {
    return (
      <main className="detail-status">
        <p aria-live="polite">
          {t(
            'upload.loadingSession',
          )}
        </p>
      </main>
    );
  }

  if (
    sessionQuery.error
    || !session
    || session.status
      === 'abandoned'
  ) {
    return (
      <main className="detail-status">
        <h1>
          {t(
            'upload.reviewTitle',
          )}
        </h1>
        <p>
          {sessionQuery.error
            ?.message
            ?? t(
              'upload.sessionUnavailable',
            )}
        </p>
        <Link
          className="text-link"
          to="/studio"
        >
          <ArrowLeft size={16} />
          {t('detail.back')}
        </Link>
      </main>
    );
  }

  const backPath =
    session.kind === 'append'
    && session.memoryId
      ? `/memory/${session.memoryId}`
      : '/studio';

  return (
    <main className="upload-session-review-page">
      <Link
        className="detail-back"
        to={backPath}
      >
        <ArrowLeft size={16} />
        {t('detail.back')}
      </Link>

      <header className="studio-intro">
        <p>
          {session.title
            ?? t(
              'upload.addPhotos',
            )}
        </p>
        <h1>
          {t(
            'upload.reviewTitle',
          )}
        </h1>
        <em>
          {session.kind
            === 'create'
            ? t(
                'upload.reviewCreateSubtitle',
              )
            : t(
                'upload.reviewAppendSubtitle',
              )}
        </em>
      </header>

      <SessionProgressBanner
        completed={
          session
            .completedFileCount
        }
        total={
          session
            .expectedFileCount
        }
        message={
          session.status
            === 'review'
            ? t(
                'upload.readyToReview',
              )
            : t(
                'upload.uploading',
              )
        }
        error={error}
      />

      {publicIncluded ? (
        <p className="privacy-warning review-public-warning">
          {t(
            'upload.publicWarning',
          )}
        </p>
      ) : null}

      {recoveryMode
        === 'reselect' ? (
          <section className="form-panel upload-recovery-panel">
            <h2>
              {t(
                'upload.reselectOriginals',
              )}
            </h2>
            <p>
              {t(
                'upload.reselectHelp',
              )}
            </p>

            <label className="primary-button">
              <UploadCloud
                size={16}
              />
              {t(
                'upload.reselectOriginals',
              )}
              <input
                className="visually-hidden"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={busy}
                onChange={(event) => {
                  const files =
                    Array.from(
                      event
                        .target
                        .files
                      ?? [],
                    );

                  event.target.value =
                    '';

                  if (
                    files.length > 0
                  ) {
                    void reselectAndResume(
                      files,
                    );
                  }
                }}
              />
            </label>
          </section>
        ) : null}

      {recoveryMode
        === 'retry' ? (
          <section className="form-panel upload-recovery-panel">
            <p>
              {t(
                'upload.reselectHelp',
              )}
            </p>
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() =>
                void retryUpload()
              }
            >
              <RotateCcw
                size={16}
              />
              {t(
                'upload.retryUpload',
              )}
            </button>
          </section>
        ) : null}

      {draft ? (
        <UploadSessionReviewGrid
          draft={draft}
          previewBySessionFileId={
            previewBySessionFileId
          }
          busy={
            busy
            || session.status
              !== 'review'
          }
          labels={{
            missingPreview:
              t(
                'upload.missingPreview',
              ),
            unavailablePreview:
              t(
                'image.unavailable',
              ),
            retryPreview:
              t(
                'image.retry',
              ),
            public:
              t(
                'upload.public',
              ),
            private:
              t(
                'upload.private',
              ),
            duplicateSkipped:
              t(
                'upload.duplicateSkipped',
              ),
            stillAdd:
              t(
                'upload.keepDuplicate',
              ),
            remove:
              t(
                'upload.remove',
              ),
            include:
              t(
                'upload.include',
              ),
            setCover:
              t(
                'upload.setCover',
              ),
            cover:
              t(
                'upload.cover',
              ),
            moveUp:
              t(
                'upload.moveUp',
              ),
            moveDown:
              t(
                'upload.moveDown',
              ),
          }}
          onVisibility={(
            fileId,
            visibility,
          ) =>
            setDraft(
              (current) =>
                current
                  ? setReviewVisibility(
                      current,
                      fileId,
                      visibility,
                    )
                  : current,
            )
          }
          onKeepDuplicate={(
            fileId,
          ) =>
            setDraft(
              (current) =>
                current
                  ? keepReviewDuplicate(
                      current,
                      fileId,
                    )
                  : current,
            )
          }
          onSkipped={(
            fileId,
            skipped,
          ) =>
            setDraft(
              (current) =>
                current
                  ? setReviewSkipped(
                      current,
                      fileId,
                      skipped,
                    )
                  : current,
            )
          }
          onCover={(
            fileId,
          ) =>
            setDraft(
              (current) =>
                current
                  ? setReviewCover(
                      current,
                      fileId,
                    )
                  : current,
            )
          }
          onMove={(
            fileId,
            direction,
          ) =>
            setDraft(
              (current) =>
                current
                  ? moveReviewFile(
                      current,
                      fileId,
                      direction,
                    )
                  : current,
            )
          }
        />
      ) : null}

      {recoveryMode
        === 'review'
      && draft ? (
        <ReviewActions
          busy={busy}
          confirmDisabled={
            blocker !== null
          }
          saveLabel={
            t(
              'upload.saveReview',
            )
          }
          confirmLabel={
            session.kind
              === 'create'
              ? t(
                  'upload.confirmCreate',
                )
              : t(
                  'upload.confirmAppend',
                )
          }
          abandonLabel={
            t(
              'upload.abandon',
            )
          }
          onSave={() =>
            void saveReview()
          }
          onConfirm={() =>
            void confirmReview()
          }
          onAbandon={() =>
            void abandonReview()
          }
        />
      ) : null}
    </main>
  );
}

function reviewBlockingMessage(
  reason:
    ReviewBlockingReason,
  t: Translator,
): string {
  switch (reason) {
    case 'no-included-photos':
      return t(
        'upload.noIncludedPhotos',
      );

    case 'upload-incomplete':
      return t(
        'upload.incompletePhotos',
      );

    case 'cover-required':
      return t(
        'upload.coverRequired',
      );
  }
}
