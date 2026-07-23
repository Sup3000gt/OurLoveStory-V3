import { useEffect, useState } from 'react';
import type { ImageAsset } from '../../shared/contracts';

export interface ImageLightboxProps {
  asset: ImageAsset;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  closeLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
  downloadLabel?: string;
}

export function ImageLightbox({
  asset,
  onClose,
  onPrevious,
  onNext,
  closeLabel = 'Close image',
  previousLabel = 'Previous image',
  nextLabel = 'Next image',
  downloadLabel = 'Download original',
}: ImageLightboxProps) {
  const [imageSrc, setImageSrc] = useState(asset.previewUrl);

  useEffect(() => {
    setImageSrc(asset.previewUrl);
  }, [asset.id, asset.previewUrl]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') onPrevious();
      if (event.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrevious]);

  return (
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={asset.filename}
    >
      <div className="image-lightbox-backdrop" aria-hidden="true" onClick={onClose} />
      <button type="button" className="image-lightbox-close" aria-label={closeLabel} onClick={onClose}>
        ×
      </button>
      <button type="button" className="image-lightbox-previous" aria-label={previousLabel} onClick={onPrevious}>
        ‹
      </button>
      <img
        className="image-lightbox-image"
        src={imageSrc}
        alt={asset.filename}
        onError={() => {
          if (imageSrc !== asset.thumbnailUrl) setImageSrc(asset.thumbnailUrl);
        }}
      />
      <button type="button" className="image-lightbox-next" aria-label={nextLabel} onClick={onNext}>
        ›
      </button>
      {asset.originalUrl ? (
        <a href={asset.originalUrl} download={asset.filename}>
          {downloadLabel}
        </a>
      ) : null}
    </div>
  );
}
