import type { Memory } from '../../shared/contracts';
import { MemoryCard } from './MemoryCard';

type GalleryVariant = 'portrait' | 'masonry';

interface GalleryGridProps {
  memories: Memory[];
  variant?: GalleryVariant;
  isOwner: boolean;
}

export function GalleryGrid({
  memories,
  variant = 'portrait',
  isOwner,
}: GalleryGridProps) {
  return (
    <div className={`memory-grid memory-grid-${variant}`}>
      {memories.map((memory) => (
        <MemoryCard key={memory.id} memory={memory} isOwner={isOwner} />
      ))}
    </div>
  );
}
