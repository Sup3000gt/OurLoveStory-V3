import type { Memory } from '../../shared/contracts';
import { MemoryCard } from './MemoryCard';

type GalleryVariant = 'portrait' | 'masonry';

interface GalleryGridProps {
  memories: Memory[];
  variant?: GalleryVariant;
}

export function GalleryGrid({ memories, variant = 'portrait' }: GalleryGridProps) {
  return (
    <div className={`memory-grid memory-grid-${variant}`}>
      {memories.map((memory) => <MemoryCard key={memory.id} memory={memory} />)}
    </div>
  );
}
