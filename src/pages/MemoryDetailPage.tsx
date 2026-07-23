import {
  useAuth,
} from '@clerk/react';
import {
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  Download,
  Globe2,
  ImagePlus,
  LockKeyhole,
  MapPin,
  Trash2,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import type {
  Memory,
  MemoryAsset,
  MemoryPage,
  Visibility,
} from '../../shared/contracts';
import { DerivativeImage } from '../components/DerivativeImage';
import { ImageLightbox } from '../components/ImageLightbox';
import {
  activeAppendSessionForMemory,
  useUploadSessions,
} from '../hooks/useUploadSessions';
import { useMemory } from '../hooks/useMemory';
import {
  categoryTranslationKeys,
} from '../i18n/translations';
import {
  useTranslation,
} from '../i18n/useTranslation';
import {
  clearTimelineCover,
  deleteMemoryAsset,
  setTimelineCover,
  updateAssetVisibility,
} from '../lib/api';
import {
  formatMemoryDate,
} from '../lib/format';
import {
  applyAssetDeletion,
  adjacentImageAssetId,
  imageAssetsForLightbox,
} from '../lib/memory-assets';
import { updateMemoryPages } from '../lib/memory-pages';
import {
  replaceAssetVisibility,
} from '../lib/memory-visibility';

interface MemoryDetailPageProps {
  memories: Memory[];
  isLoading: boolean;
  isOwner: boolean;
}

export function MemoryDetailPage({
  memories,
  isLoading,
  isOwner,
}: MemoryDetailPageProps) {
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

  const location =
    useLocation();

  const {
    language,
    t,
  } = useTranslation();

  const uploadSessions =
    useUploadSessions(isOwner);

  const [
    pendingAssetId,
    setPendingAssetId,
  ] = useState<
    string | null
  >(null);

  const [
    pendingDeleteAssetId,
    setPendingDeleteAssetId,
  ] = useState<
    string | null
  >(null);

  const [
    updatedAssetId,
    setUpdatedAssetId,
  ] = useState<
    string | null
  >(null);

  const [
    visibilityError,
    setVisibilityError,
  ] = useState('');

  const [
    deleteError,
    setDeleteError,
  ] = useState('');

  const [
    selectedImageId,
    setSelectedImageId,
  ] = useState<string | null>(null);

  const [
    pendingTimelineAssetId,
    setPendingTimelineAssetId,
  ] = useState<string | null>(null);

  const [
    timelineCoverError,
    setTimelineCoverError,
  ] = useState('');

  const successTimer =
    useRef<
      number | null
    >(null);

  const initializedAssetQuery =
    useRef<string | null>(null);

  const memoryFromList =
    memories.find(
      (candidate) =>
      candidate.id
        === memoryId,
    );

  const memoryQuery = useMemory(memoryId, memoryFromList);
  const memory = memoryFromList ?? memoryQuery.data;

  const imageAssets = memory ? imageAssetsForLightbox(memory) : [];
  const selectedImage = imageAssets.find((asset) => asset.id === selectedImageId) ?? null;
  const assetQuery = new URLSearchParams(location.search).get('asset');

  const activeAppend =
    memory
      ? activeAppendSessionForMemory(
          uploadSessions.data
            ?? [],
          memory.id,
        )
      : null;

  const interactionBusy =
    pendingAssetId !== null
    || pendingDeleteAssetId
      !== null;

  useEffect(
    () => () => {
      if (
        successTimer.current
        !== null
      ) {
        window.clearTimeout(
          successTimer.current,
        );
      }
    },
    [],
  );

  useEffect(
    () => {
      if (
        !memory
        || initializedAssetQuery.current === assetQuery
      ) {
        return;
      }

      initializedAssetQuery.current = assetQuery;

      const selectedAsset = imageAssets.find(
        (asset) => asset.id === assetQuery
          && asset.visibility === 'public',
      );

      setSelectedImageId(
        selectedAsset
          ? selectedAsset.id
          : null,
      );
    },
    [
      assetQuery,
      imageAssets,
      memory,
    ],
  );

  async function toggleVisibility(
    asset: MemoryAsset,
  ) {
    if (
      !isOwner
      || interactionBusy
    ) {
      return;
    }

    const nextVisibility:
      Visibility =
        asset.visibility
          === 'public'
          ? 'private'
          : 'public';

    const snapshots =
      queryClient
        .getQueriesData<
          InfiniteData<MemoryPage>
        >({
          queryKey: [
            'memories',
          ],
        });

    setVisibilityError('');
    setDeleteError('');
    setUpdatedAssetId(null);
    setPendingAssetId(
      asset.id,
    );

    queryClient
      .setQueriesData<
        InfiniteData<MemoryPage>
      >(
        {
          queryKey: [
            'memories',
          ],
        },
        (current) => updateMemoryPages(
          current,
          (memories) => replaceAssetVisibility(
            memories,
            asset.id,
            nextVisibility,
          ),
        ),
      );

    try {
      await updateAssetVisibility(
        asset.id,
        nextVisibility,
        getToken,
      );

      await queryClient
        .invalidateQueries({
          queryKey: [
            'memories',
          ],
        });

      await queryClient.invalidateQueries({
        queryKey: [
          'timeline',
        ],
      });

      setUpdatedAssetId(
        asset.id,
      );

      if (
        successTimer.current
        !== null
      ) {
        window.clearTimeout(
          successTimer.current,
        );
      }

      successTimer.current =
        window.setTimeout(
          () =>
            setUpdatedAssetId(
              null,
            ),
          1800,
        );
    } catch {
      for (
        const [
          queryKey,
          data,
        ] of snapshots
      ) {
        queryClient
          .setQueryData(
            queryKey,
            data,
          );
      }

      setVisibilityError(
        t(
          'detail.saveFailed',
        ),
      );
    } finally {
      setPendingAssetId(
        null,
      );
    }
  }

  async function removeAsset(
    asset: MemoryAsset,
  ) {
    if (
      !isOwner
      || interactionBusy
      || !memory
    ) {
      return;
    }

    if (
      !window.confirm(
        t(
          'detail.deleteConfirm',
        ),
      )
    ) {
      return;
    }

    setVisibilityError('');
    setDeleteError('');
    setUpdatedAssetId(null);
    setPendingDeleteAssetId(
      asset.id,
    );

    try {
      const response =
        await deleteMemoryAsset(
          asset.id,
          getToken,
        );

      queryClient
        .setQueriesData<
          InfiniteData<MemoryPage>
        >(
          {
            queryKey: [
              'memories',
            ],
          },
          (current) => updateMemoryPages(
            current,
            (memories) => applyAssetDeletion(
              memories,
              response,
            ),
          ),
        );

      await queryClient
        .invalidateQueries({
          queryKey: [
            'memories',
          ],
        });

      await queryClient.invalidateQueries({
        queryKey: [
          'timeline',
        ],
      });

      if (
        response.deletedMemory
      ) {
        navigate(
          '/gallery',
          {
            replace: true,
          },
        );
      }
    } catch {
      setDeleteError(
        t(
          'detail.deleteFailed',
        ),
      );
    } finally {
      setPendingDeleteAssetId(
        null,
      );
    }
  }

  async function updateTimelineCover(
    asset: MemoryAsset,
    periodType: 'year' | 'month',
    action: 'set' | 'clear',
  ) {
    if (
      !isOwner
      || !memory
      || memory.status !== 'published'
      || asset.type !== 'image'
      || asset.visibility !== 'public'
      || pendingTimelineAssetId !== null
    ) {
      return;
    }

    const periodKey =
      periodType === 'year'
        ? memory.date.slice(0, 4)
        : memory.date.slice(0, 7);

    setTimelineCoverError('');
    setPendingTimelineAssetId(
      asset.id,
    );

    try {
      if (action === 'set') {
        await setTimelineCover(
          {
            periodType,
            periodKey,
            assetId: asset.id,
          },
          getToken,
        );
      } else {
        await clearTimelineCover(
          periodType,
          periodKey,
          getToken,
        );
      }

      await queryClient.invalidateQueries({
        queryKey: [
          'timeline',
        ],
      });
    } catch {
      setTimelineCoverError(
        t(
          'detail.timelineCoverFailed',
        ),
      );
    } finally {
      setPendingTimelineAssetId(
        null,
      );
    }
  }

  if (isLoading || memoryQuery.isLoading) {
    return (
      <main className="detail-status">
        {t(
          'detail.loading',
        )}
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
    <main className="memory-detail-page">
      <Link
        className="detail-back"
        to="/gallery"
      >
        <ArrowLeft size={16} />
        {t('detail.back')}
      </Link>

      <header className="detail-heading">
        <div className="detail-title-line">
          <h1>
            {memory.title}
          </h1>

          {memory.status
            === 'draft' ? (
              <span className="draft-badge detail-visibility">
                {t(
                  'memory.draft',
                )}
              </span>
            ) : null}

          {isOwner ? (
            <div className="detail-upload-actions">
              <Link
                className="primary-button detail-add-photos"
                to={
                  `/memory/${memory.id}/add-photos`
                }
              >
                <ImagePlus
                  size={16}
                />
                {activeAppend
                  ? t(
                      'detail.continueAddingPhotos',
                    )
                  : t(
                      'detail.addPhotos',
                    )}
              </Link>

              {activeAppend ? (
                <small className="detail-active-upload-progress">
                  {t(
                    'upload.progressCount',
                    {
                      completed:
                        activeAppend
                          .completedFileCount,
                      total:
                        activeAppend
                          .expectedFileCount,
                    },
                  )}
                </small>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="detail-metadata">
          <span>
            <MapPin size={16} />
            {memory.location}
          </span>

          <span>
            <CalendarDays
              size={16}
            />
            {formatMemoryDate(
              memory.date,
              language,
            )}
          </span>

          <span>
            {t(
              categoryTranslationKeys[
                memory.category
              ],
            )}
          </span>
        </div>

        {memory.description ? (
          <p>
            {memory.description}
          </p>
        ) : null}

        {visibilityError ? (
          <p
            className="asset-visibility-error"
            role="alert"
          >
            {visibilityError}
          </p>
        ) : null}

        {deleteError ? (
          <p
            className="asset-delete-error"
            role="alert"
          >
            {deleteError}
          </p>
        ) : null}

        {timelineCoverError ? (
          <p
            className="asset-visibility-error"
            role="alert"
          >
            {timelineCoverError}
          </p>
        ) : null}
      </header>

      <section
        className="asset-gallery"
        aria-label={
          t(
            'detail.mediaLabel',
            {
              title:
                memory.title,
            },
          )
        }
      >
        {memory.assets.map(
          (asset) => (
            <article
              className="asset-frame"
              key={asset.id}
            >
              <div className="asset-media">
                {asset.type
                  === 'video' ? (
                    <video
                      src={
                        asset.url
                      }
                      controls
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <DerivativeImage
                      src={asset.thumbnailUrl}
                      alt={`${memory.title} — ${asset.filename}`}
                      originalUrl={isOwner ? asset.originalUrl : null}
                      originalFilename={asset.filename}
                      downloadLabel={t('memory.downloadOriginal')}
                      loading="lazy"
                      onClick={() => setSelectedImageId(asset.id)}
                    />
                  )}
              </div>

              <div className="asset-footer">
                <span
                  className="asset-filename"
                  title={
                    asset.filename
                  }
                >
                  {asset.filename}
                </span>

                <div className="asset-footer-actions">
                  {isOwner ? (
                    <>
                      <button
                        className={
                          `asset-visibility-toggle ${
                            asset.visibility
                          }`
                        }
                        type="button"
                        aria-pressed={
                          asset.visibility
                          === 'public'
                        }
                        aria-label={
                          asset.visibility
                          === 'public'
                            ? t(
                                'detail.makePrivate',
                              )
                            : t(
                                'detail.makePublic',
                              )
                        }
                        disabled={
                          interactionBusy
                        }
                        onClick={() =>
                          void toggleVisibility(
                            asset,
                          )
                        }
                      >
                        {asset.visibility
                          === 'public'
                          ? (
                              <Globe2
                                size={16}
                              />
                            )
                          : (
                              <LockKeyhole
                                size={16}
                              />
                            )}

                        {pendingAssetId
                          === asset.id
                          ? t(
                              'detail.saving',
                            )
                          : updatedAssetId
                              === asset.id
                            ? t(
                                'detail.updated',
                              )
                            : asset.visibility
                                === 'public'
                              ? t(
                                  'memory.public',
                                )
                              : t(
                                  'memory.private',
                                )}
                      </button>

                      <button
                        className="asset-delete-button"
                        type="button"
                        aria-label={
                          t(
                            'detail.deleteAssetLabel',
                            {
                              filename:
                                asset.filename,
                            },
                          )
                        }
                        disabled={
                          interactionBusy
                        }
                        onClick={() =>
                          void removeAsset(
                            asset,
                          )
                        }
                      >
                        <Trash2
                          size={16}
                        />
                        {pendingDeleteAssetId
                          === asset.id
                          ? t(
                              'detail.deleting',
                            )
                          : t(
                              'detail.delete',
                            )}
                      </button>
                    </>
                  ) : null}

                  {asset.type === 'video' || (isOwner && asset.originalUrl) ? (
                    <a
                      className="secondary-button"
                      href={asset.type === 'video' ? asset.downloadUrl : asset.originalUrl!}
                      download={asset.filename}
                    >
                      <Download size={16} />
                      {t('memory.downloadOriginal')}
                    </a>
                  ) : null}
                </div>

                {isOwner
                && memory.status === 'published'
                && asset.type === 'image'
                && asset.visibility === 'public' ? (
                  <details
                    className="asset-timeline-cover-controls"
                    data-timeline-cover-controls={asset.id}
                  >
                    <summary>
                      {t(
                        'detail.timelineCoverControls',
                      )}
                    </summary>

                    <div className="asset-timeline-cover-actions">
                      <button
                        type="button"
                        disabled={
                          pendingTimelineAssetId !== null
                        }
                        onClick={() =>
                          void updateTimelineCover(
                            asset,
                            'year',
                            'set',
                          )
                        }
                      >
                        {pendingTimelineAssetId
                          === asset.id
                          ? t(
                              'detail.timelineCoverSaving',
                            )
                          : t(
                              'detail.setYearCover',
                              {
                                year:
                                  memory.date.slice(0, 4),
                              },
                            )}
                      </button>

                      <button
                        type="button"
                        disabled={
                          pendingTimelineAssetId !== null
                        }
                        onClick={() =>
                          void updateTimelineCover(
                            asset,
                            'month',
                            'set',
                          )
                        }
                      >
                        {pendingTimelineAssetId
                          === asset.id
                          ? t(
                              'detail.timelineCoverSaving',
                            )
                          : t(
                              'detail.setMonthCover',
                              {
                                month:
                                  memory.date.slice(0, 7),
                              },
                            )}
                      </button>

                      <button
                        type="button"
                        disabled={
                          pendingTimelineAssetId !== null
                        }
                        onClick={() =>
                          void updateTimelineCover(
                            asset,
                            'year',
                            'clear',
                          )
                        }
                      >
                        {pendingTimelineAssetId
                          === asset.id
                          ? t(
                              'detail.timelineCoverSaving',
                            )
                          : t(
                              'detail.clearYearCover',
                              {
                                year:
                                  memory.date.slice(0, 4),
                              },
                            )}
                      </button>

                      <button
                        type="button"
                        disabled={
                          pendingTimelineAssetId !== null
                        }
                        onClick={() =>
                          void updateTimelineCover(
                            asset,
                            'month',
                            'clear',
                          )
                        }
                      >
                        {pendingTimelineAssetId
                          === asset.id
                          ? t(
                              'detail.timelineCoverSaving',
                            )
                          : t(
                              'detail.clearMonthCover',
                              {
                                month:
                                  memory.date.slice(0, 7),
                              },
                            )}
                      </button>
                    </div>
                  </details>
                ) : null}
              </div>
            </article>
          ),
        )}
      </section>
      {selectedImage ? (
        <ImageLightbox
          asset={isOwner ? selectedImage : { ...selectedImage, originalUrl: null }}
          onClose={() => setSelectedImageId(null)}
          onPrevious={() => {
            const previousId = adjacentImageAssetId(memory, selectedImage.id, -1);
            if (previousId) setSelectedImageId(previousId);
          }}
          onNext={() => {
            const nextId = adjacentImageAssetId(memory, selectedImage.id, 1);
            if (nextId) setSelectedImageId(nextId);
          }}
          closeLabel={t('image.close')}
          previousLabel={t('image.previous')}
          nextLabel={t('image.next')}
          downloadLabel={t('memory.downloadOriginal')}
        />
      ) : null}
    </main>
  );
}
