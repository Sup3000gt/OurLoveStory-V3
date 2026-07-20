import { useMemo, useState } from 'react';
import type { Memory } from '../data/memories';
import { GalleryGrid } from '../components/GalleryGrid';

export function GalleryPage({ memories }: { memories: Memory[] }) {
  const [category, setCategory] = useState('All');
  const categories = ['All', 'Travel', 'Daily Life', 'Homemade Food', 'Dining Out', 'Special Moments'];
  const filtered = useMemo(() => category === 'All' ? memories : memories.filter((m) => m.category === category), [category, memories]);
  return (
    <main className="page-shell">
      <header className="page-intro"><p>OUR COLLECTION</p><h1>Every memory has a place here.</h1><span>Photos, food, travels, quiet evenings, and everything in between.</span></header>
      <div className="filter-row" role="group" aria-label="Filter memories by category">
        {categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      <GalleryGrid memories={filtered}/>
    </main>
  );
}
