import { useMemo, useState } from 'react';
import type { Memory } from '../../shared/contracts';
import { MEMORY_CATEGORIES } from '../../shared/contracts';
import { GalleryGrid } from '../components/GalleryGrid';

interface GalleryPageProps {
  memories: Memory[];
  isLoading: boolean;
  error: Error | null;
}

export function GalleryPage({ memories, isLoading, error }: GalleryPageProps) {
  const [category, setCategory] = useState<string>('All');
  const categories = ['All', ...MEMORY_CATEGORIES];
  const filtered = useMemo(
    () => (category === 'All' ? memories : memories.filter((memory) => memory.category === category)),
    [category, memories],
  );

  return (
    <main className="page-shell">
      <header className="page-intro">
        <p>OUR COLLECTION</p>
        <h1>Every memory has a place here.</h1>
        <span>Photos, food, travels, quiet evenings, and everything in between.</span>
      </header>
      <div className="filter-row" role="group" aria-label="Filter memories by category">
        {categories.map((item) => (
          <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>
            {item}
          </button>
        ))}
      </div>
      {isLoading ? <div className="gallery-status">Gathering our memories…</div> : null}
      {error ? <div className="gallery-status error">{error.message}</div> : null}
      {!isLoading && !error && filtered.length === 0 ? (
        <div className="gallery-status">There are no memories in this collection yet.</div>
      ) : null}
      {filtered.length > 0 ? <GalleryGrid memories={filtered} /> : null}
    </main>
  );
}
