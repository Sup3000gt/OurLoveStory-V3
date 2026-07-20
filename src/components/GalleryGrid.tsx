import type { Memory } from '../data/memories';
import { MemoryCard } from './MemoryCard';
export function GalleryGrid({ memories }: { memories: Memory[] }) {
  return <div className="memory-grid">{memories.map((m) => <MemoryCard key={m.id} memory={m}/>)}</div>;
}
