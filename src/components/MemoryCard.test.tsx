import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Memory } from '../../shared/contracts';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../i18n/useTranslation', () => ({
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}));
vi.mock('react-router-dom', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <a {...props}>{children}</a>,
}));

import { MemoryCard } from './MemoryCard';

const image = {
  id: 'image-1', type: 'image' as const, thumbnailUrl: '/thumb', previewUrl: '/preview',
  originalUrl: null, filename: 'photo.jpg',
  mimeType: 'image/jpeg', sizeBytes: 1, sortOrder: 0, visibility: 'public' as const,
};
const video = {
  id: 'video-1', type: 'video' as const, url: '/video', downloadUrl: '/video-download',
  filename: 'clip.mp4', mimeType: 'video/mp4', sizeBytes: 1, sortOrder: 0, visibility: 'public' as const,
};
const memory = (asset: typeof image | typeof video): Memory => ({
  id: 'memory-1', title: 'Trip', location: 'NY', date: '2026-07-20', description: '',
  category: 'Travel', visibility: 'public', featured: false, status: 'published',
  coverAssetId: asset.id, assets: [asset], createdAt: '', updatedAt: '',
});

const roots: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];
afterEach(() => {
  for (const { root, container } of roots.splice(0)) { act(() => root.unmount()); container.remove(); }
});

function renderCard(value: Memory, isOwner = false) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push({ root, container });
  act(() => root.render(<MemoryCard memory={value} isOwner={isOwner} />));
  return container;
}

describe('MemoryCard image delivery', () => {
  it('renders image covers through DerivativeImage using the thumbnail', () => {
    const container = renderCard(memory(image));
    expect(container.querySelector('.derivative-image img')?.getAttribute('src')).toBe('/thumb');
    expect(container.querySelector('img')?.getAttribute('src')).not.toBe('/legacy');
  });

  it('keeps video covers on the video URL', () => {
    const container = renderCard(memory(video));
    expect(container.querySelector('video')?.getAttribute('src')).toBe('/video');
  });

  it('does not render an image download when the original is unavailable', () => {
    const container = renderCard(memory(image), true);
    expect(container.querySelector('a[download]')).toBeNull();
  });
});
