import { CalendarDays, Download, LockKeyhole, MapPin } from 'lucide-react';
import type { Memory } from '../data/memories';
import { formatMemoryDate } from '../lib/format';

export function MemoryCard({ memory }: { memory: Memory }) {
  return (
    <article className="memory-card">
      <div className="memory-image-wrap">
        <img src={memory.cover} alt={memory.title} loading="lazy" />
        <span className={`visibility-badge ${memory.visibility}`}>
          {memory.visibility === 'private' ? <LockKeyhole size={12}/> : null}{memory.visibility}
        </span>
      </div>
      <div className="memory-body">
        <div className="memory-title-row"><h3>{memory.title}</h3>
          <a className="icon-button" href={memory.assets[0].originalUrl} download={memory.assets[0].filename} aria-label={`Download original ${memory.title}`}><Download size={17}/></a>
        </div>
        <div className="metadata"><span><MapPin size={14}/>{memory.location}</span><span><CalendarDays size={14}/>{formatMemoryDate(memory.date)}</span></div>
        <p>{memory.description}</p>
      </div>
    </article>
  );
}
