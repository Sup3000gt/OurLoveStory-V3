import type { Memory } from '../../shared/contracts';
import { MemoryCard } from './MemoryCard';

type GalleryVariant = 'portrait' | 'masonry';

interface GalleryGridProps {
  memories: Memory[];
  variant?: GalleryVariant;
  isOwner: boolean;
  prioritizeFirstTwo?: boolean;
}

export function GalleryGrid({
  memories,
  variant = 'portrait',
  isOwner,
  prioritizeFirstTwo = false,
}: GalleryGridProps) {
  return (
    <div className={`memory-grid memory-grid-${variant}`}>
      {memories.map((memory, index) => (
        <MemoryCard
          key={memory.id}
          memory={memory}
          isOwner={isOwner}
          priority={prioritizeFirstTwo && index < 2}
        />
      ))}
    </div>
  );
}
