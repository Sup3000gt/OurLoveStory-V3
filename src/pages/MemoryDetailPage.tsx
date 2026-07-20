import { useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  Download,
  Globe2,
  LockKeyhole,
  MapPin,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Memory, MemoryAsset, Visibility } from '../../shared/contracts';
import { categoryTranslationKeys } from '../i18n/translations';
import { useTranslation } from '../i18n/useTranslation';
import { updateAssetVisibility } from '../lib/api';
import { formatMemoryDate } from '../lib/format';
import { replaceAssetVisibility } from '../lib/memory-visibility';

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
  const { memoryId } = useParams();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { language, t } = useTranslation();
  const [pendingAssetId, setPendingAssetId] = useState<string | null>(null);
  const [updatedAssetId, setUpdatedAssetId] = useState<string | null>(null);
  const [visibilityError, setVisibilityError] = useState('');
  const successTimer = useRef<number | null>(null);
  const memory = memories.find((candidate) => candidate.id === memoryId);

  useEffect(() => () => {
    if (successTimer.current !== null) window.clearTimeout(successTimer.current);
  }, []);

  async function toggleVisibility(asset: MemoryAsset) {
    if (!isOwner || pendingAssetId) return;
    const nextVisibility: Visibility = asset.visibility === 'public' ? 'private' : 'public';
    const snapshots = queryClient.getQueriesData<Memory[]>({ queryKey: ['memories'] });

    setVisibilityError('');
    setUpdatedAssetId(null);
    setPendingAssetId(asset.id);
    queryClient.setQueriesData<Memory[]>(
      { queryKey: ['memories'] },
      (current) => current ? replaceAssetVisibility(current, asset.id, nextVisibility) : current,
    );

    try {
      await updateAssetVisibility(asset.id, nextVisibility, getToken);
      await queryClient.invalidateQueries({ queryKey: ['memories'] });
      setUpdatedAssetId(asset.id);
      if (successTimer.current !== null) window.clearTimeout(successTimer.current);
      successTimer.current = window.setTimeout(() => setUpdatedAssetId(null), 1800);
    } catch {
      for (const [queryKey, data] of snapshots) {
        queryClient.setQueryData(queryKey, data);
      }
      setVisibilityError(t('detail.saveFailed'));
    } finally {
      setPendingAssetId(null);
    }
  }

  if (isLoading) return <main className="detail-status">{t('detail.loading')}</main>;
  if (!memory) {
    return (
      <main className="detail-status">
        <h1>{t('detail.unavailableTitle')}</h1>
        <p>{t('detail.unavailableText')}</p>
        <Link className="text-link" to="/gallery">
          <ArrowLeft size={16} />{t('detail.back')}
        </Link>
      </main>
    );
  }

  return (
    <main className="memory-detail-page">
      <Link className="detail-back" to="/gallery">
        <ArrowLeft size={16} />{t('detail.back')}
      </Link>
      <header className="detail-heading">
        <div className="detail-title-line">
          <h1>{memory.title}</h1>
          {memory.status === 'draft' ? (
            <span className="draft-badge detail-visibility">{t('memory.draft')}</span>
          ) : null}
        </div>
        <div className="detail-metadata">
          <span><MapPin size={16} />{memory.location}</span>
          <span><CalendarDays size={16} />{formatMemoryDate(memory.date, language)}</span>
          <span>{t(categoryTranslationKeys[memory.category])}</span>
        </div>
        {memory.description ? <p>{memory.description}</p> : null}
        {visibilityError ? (
          <p className="asset-visibility-error" role="alert">{visibilityError}</p>
        ) : null}
      </header>

      <section className="asset-gallery" aria-label={t('detail.mediaLabel', { title: memory.title })}>
        {memory.assets.map((asset) => (
          <article className="asset-frame" key={asset.id}>
            <div className="asset-media">
              {asset.type === 'video' ? (
                <video src={asset.url} controls playsInline preload="metadata" />
              ) : (
                <img src={asset.url} alt={`${memory.title} — ${asset.filename}`} loading="lazy" />
              )}
            </div>
            <div className="asset-footer">
              <span className="asset-filename" title={asset.filename}>{asset.filename}</span>
              <div className="asset-footer-actions">
                {isOwner ? (
                  <button
                    className={`asset-visibility-toggle ${asset.visibility}`}
                    type="button"
                    aria-pressed={asset.visibility === 'public'}
                    aria-label={
                      asset.visibility === 'public'
                        ? t('detail.makePrivate')
                        : t('detail.makePublic')
                    }
                    disabled={pendingAssetId !== null}
                    onClick={() => void toggleVisibility(asset)}
                  >
                    {asset.visibility === 'public' ? <Globe2 size={16} /> : <LockKeyhole size={16} />}
                    {pendingAssetId === asset.id
                      ? t('detail.saving')
                      : updatedAssetId === asset.id
                        ? t('detail.updated')
                        : asset.visibility === 'public'
                          ? t('memory.public')
                          : t('memory.private')}
                  </button>
                ) : null}
                <a
                  className="secondary-button"
                  href={asset.downloadUrl}
                  download={asset.filename}
                >
                  <Download size={16} />{t('memory.downloadOriginal')}
                </a>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
