import { ArrowLeft, CalendarDays, Download, LockKeyhole, MapPin } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { Memory } from '../../shared/contracts';
import { formatMemoryDate } from '../lib/format';

export function MemoryDetailPage({ memories, isLoading }: { memories: Memory[]; isLoading: boolean }) {
  const { memoryId } = useParams();
  const memory = memories.find((candidate) => candidate.id === memoryId);

  if (isLoading) return <main className="detail-status">Opening this memory…</main>;
  if (!memory) {
    return (
      <main className="detail-status">
        <h1>This memory is not available.</h1>
        <p>It may be private, unpublished, or no longer exist.</p>
        <Link className="text-link" to="/gallery"><ArrowLeft size={16} />Back to gallery</Link>
      </main>
    );
  }

  return (
    <main className="memory-detail-page">
      <Link className="detail-back" to="/gallery"><ArrowLeft size={16} />Back to gallery</Link>
      <header className="detail-heading">
        <div className="detail-title-line">
          <h1>{memory.title}</h1>
          {memory.status === 'draft' ? <span className="draft-badge detail-visibility">draft</span> : null}
          <span className={`visibility-badge detail-visibility ${memory.visibility}`}>
            {memory.visibility === 'private' ? <LockKeyhole size={13} /> : null}{memory.visibility}
          </span>
        </div>
        <div className="detail-metadata">
          <span><MapPin size={16} />{memory.location}</span>
          <span><CalendarDays size={16} />{formatMemoryDate(memory.date)}</span>
          <span>{memory.category}</span>
        </div>
        {memory.description ? <p>{memory.description}</p> : null}
      </header>

      <section className="asset-gallery" aria-label={`${memory.title} media`}>
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
              <span title={asset.filename}>{asset.filename}</span>
              <a className="secondary-button" href={asset.downloadUrl} download={asset.filename}>
                <Download size={16} />Download original
              </a>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
