import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageAsset } from '../../shared/contracts';
import { ImageLightbox } from './ImageLightbox';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

  it('renders the large preview immediately and falls back to the thumbnail on error', () => {
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

    const image = container.querySelector('img');
    expect(image?.getAttribute('src')).toBe(asset.previewUrl);
    act(() => image?.dispatchEvent(new Event('error', { bubbles: false })));
    expect(image?.getAttribute('src')).toBe(asset.thumbnailUrl);
  });

  it('closes when the backdrop is clicked but not when the image is clicked', () => {
    const onClose = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(
      <ImageLightbox
        asset={asset}
        onClose={onClose}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    ));

    const backdrop = container.querySelector('.image-lightbox-backdrop');
    const image = container.querySelector('img');
    expect(backdrop).not.toBeNull();
    act(() => backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => image?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the close control above the sticky site header', () => {
    const lightboxStyles = readFileSync(
      resolve(process.cwd(), 'src/styles/feature-upgrades.css'),
      'utf8',
    );
    const globalStyles = readFileSync(
      resolve(process.cwd(), 'src/styles/global.css'),
      'utf8',
    );
    const lightboxZIndex = Number(
      lightboxStyles.match(/\.image-lightbox\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1],
    );
    const headerZIndex = Number(
      globalStyles.match(/\.site-header\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1],
    );

    expect(lightboxZIndex).toBeGreaterThan(headerZIndex);
  });
});
