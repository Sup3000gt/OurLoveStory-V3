import type { Memory } from '../../shared/contracts';
import { MemoryCard } from './MemoryCard';

export function GalleryGrid({ memories }: { memories: Memory[] }) {
  return <div className="memory-grid">{memories.map((memory) => <MemoryCard key={memory.id} memory={memory} />)}</div>;
}
