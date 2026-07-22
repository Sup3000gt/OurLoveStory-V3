import { useState } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { appendRetryNonce } from '../lib/image-assets';

export interface DerivativeImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'loading' | 'fetchPriority'> {
  src: string;
  alt: string;
  originalUrl?: string | null;
  originalFilename?: string;
  downloadLabel?: string;
  unavailableLabel?: string;
  retryLabel?: string;
  loading?: ImgHTMLAttributes<HTMLImageElement>['loading'];
  fetchPriority?: 'high' | 'low' | 'auto';
}

export function DerivativeImage({
  src,
  alt,
  originalUrl = null,
  originalFilename,
  downloadLabel = 'Download original',
  unavailableLabel = 'This image is unavailable.',
  retryLabel = 'Retry',
  loading,
  fetchPriority,
  className,
  ...imgProps
}: DerivativeImageProps) {
  const [retryNonce, setRetryNonce] = useState<number | null>(null);
  const failed = retryNonce !== null;
  const imageSrc = retryNonce === null ? src : appendRetryNonce(src, retryNonce);

  return (
    <div className={`derivative-image${failed ? ' derivative-image-failed' : ''}`}>
      <img
        {...imgProps}
        className={className}
        src={imageSrc}
        alt={alt}
        loading={loading}
        fetchPriority={fetchPriority}
        onError={() => setRetryNonce(Date.now())}
      />
      {failed ? (
        <div className="derivative-image-error" role="status">
          <span>{unavailableLabel}</span>
          <button type="button" onClick={() => setRetryNonce(Date.now())}>
            {retryLabel}
          </button>
          {originalUrl ? (
            <a href={originalUrl} download={originalFilename}>
              {downloadLabel}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
