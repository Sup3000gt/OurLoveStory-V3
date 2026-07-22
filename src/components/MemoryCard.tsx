import { CalendarDays, Download, MapPin, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Memory } from '../../shared/contracts';
import { DerivativeImage } from './DerivativeImage';
import { useTranslation } from '../i18n/useTranslation';
import { formatMemoryDate } from '../lib/format';
import { summarizeAssetVisibility } from '../lib/memory-visibility';

interface MemoryCardProps {
  memory: Memory;
  isOwner: boolean;
}

export function MemoryCard({ memory, isOwner }: MemoryCardProps) {
  const { language, t } = useTranslation();
  const cover = memory.assets.find((asset) => asset.id === memory.coverAssetId) ?? memory.assets[0];
  if (!cover) return null;

  const visibilitySummary = summarizeAssetVisibility(memory.assets);

  return (
    <article className="memory-card">
      <Link className="memory-card-link" to={`/memory/${encodeURIComponent(memory.id)}`}>
        <div className="memory-image-wrap">
          {cover.type === 'video' ? (
            <>
              <video src={cover.url} muted playsInline preload="metadata" aria-label={memory.title} />
              <span className="play-badge"><Play size={18} fill="currentColor" /></span>
            </>
          ) : (
            <DerivativeImage
              src={cover.thumbnailUrl}
              alt={memory.title}
              originalUrl={cover.originalUrl}
              originalFilename={cover.filename}
              downloadLabel={t('memory.downloadOriginal')}
              loading="lazy"
            />
          )}
          <div className="memory-badges">
            {memory.status === 'draft' ? <span className="draft-badge">{t('memory.draft')}</span> : null}
          </div>
        </div>
      </Link>
      <div className="memory-body">
        <div className="memory-title-row">
          <Link to={`/memory/${encodeURIComponent(memory.id)}`}><h3>{memory.title}</h3></Link>
          {cover.type === 'video' || cover.originalUrl ? (
            <a
              className="icon-button"
              href={cover.type === 'video' ? cover.downloadUrl : cover.originalUrl!}
              download={cover.filename}
              aria-label={`${t('memory.downloadOriginal')}: ${memory.title}`}
              title={t('memory.downloadOriginal')}
            >
              <Download size={17} />
            </a>
          ) : null}
        </div>
        <div className="metadata">
          <span><MapPin size={14} />{memory.location}</span>
          <span><CalendarDays size={14} />{formatMemoryDate(memory.date, language)}</span>
        </div>
        <p>{memory.description}</p>
        {isOwner ? (
          <small className="asset-visibility-summary">
            {t('memory.assetSummary', {
              publicCount: visibilitySummary.publicCount,
              privateCount: visibilitySummary.privateCount,
            })}
          </small>
        ) : memory.assets.length > 1 ? (
          <small className="asset-count">
            {t('memory.assetCount', { count: memory.assets.length })}
          </small>
        ) : null}
      </div>
    </article>
  );
}
