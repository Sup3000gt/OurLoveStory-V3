import { CalendarDays, Download, LockKeyhole, MapPin, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Memory } from '../../shared/contracts';
import { formatMemoryDate } from '../lib/format';

export function MemoryCard({ memory }: { memory: Memory }) {
  const cover = memory.assets.find((asset) => asset.id === memory.coverAssetId) ?? memory.assets[0];
  if (!cover) return null;

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
            <img src={cover.url} alt={memory.title} loading="lazy" />
          )}
          <div className="memory-badges">
            {memory.status === 'draft' ? <span className="draft-badge">draft</span> : null}
            <span className={`visibility-badge ${memory.visibility}`}>
              {memory.visibility === 'private' ? <LockKeyhole size={12} /> : null}
              {memory.visibility}
            </span>
          </div>
        </div>
      </Link>
      <div className="memory-body">
        <div className="memory-title-row">
          <Link to={`/memory/${encodeURIComponent(memory.id)}`}><h3>{memory.title}</h3></Link>
          <a
            className="icon-button"
            href={cover.downloadUrl}
            download={cover.filename}
            aria-label={`Download original ${memory.title}`}
            title="Download original"
          >
            <Download size={17} />
          </a>
        </div>
        <div className="metadata">
          <span><MapPin size={14} />{memory.location}</span>
          <span><CalendarDays size={14} />{formatMemoryDate(memory.date)}</span>
        </div>
        <p>{memory.description}</p>
        {memory.assets.length > 1 ? <small className="asset-count">{memory.assets.length} photos &amp; videos</small> : null}
      </div>
    </article>
  );
}
