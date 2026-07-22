import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageAsset } from '../../shared/contracts';
import { ImageLightbox } from './ImageLightbox';

const asset: ImageAsset = {
  id: 'asset-1',
  type: 'image',
  thumbnailUrl: '/thumbnail',
  previewUrl: '/preview',
  originalUrl: '/original',
  filename: 'memory.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 1,
  sortOrder: 0,
  visibility: 'public',
};

describe('ImageLightbox', () => {
  let root: ReturnType<typeof createRoot> | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
  });

  it('keeps the thumbnail visible until the preview preloads', async () => {
    const OriginalImage = window.Image;
    let resolvePreview!: () => void;
    const preload = new Promise<void>((resolve) => { resolvePreview = resolve; });
    vi.stubGlobal('Image', class {
      set src(_value: string) { void preload.then(() => this.onload?.()); }
      onload?: () => void;
      onerror?: () => void;
    });

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(
      <ImageLightbox
        asset={asset}
        onClose={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        closeLabel="Close"
        previousLabel="Previous"
        nextLabel="Next"
        downloadLabel="Download original"
      />,
    ));

    expect(container.querySelector('img')?.getAttribute('src')).toBe(asset.thumbnailUrl);
    resolvePreview();
    await act(async () => { await preload; });
    expect(container.querySelector('img')?.getAttribute('src')).toBe(asset.previewUrl);
    vi.stubGlobal('Image', OriginalImage);
  });
});
