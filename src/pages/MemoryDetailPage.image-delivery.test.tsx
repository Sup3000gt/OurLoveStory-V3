import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Memory } from '../../shared/contracts';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: vi.fn() }) }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ getQueriesData: () => [], setQueriesData: vi.fn(), invalidateQueries: vi.fn(), setQueryData: vi.fn() }) }));
vi.mock('../hooks/useUploadSessions', () => ({ activeAppendSessionForMemory: () => null, useUploadSessions: () => ({ data: [] }) }));
vi.mock('../i18n/useTranslation', () => ({ useTranslation: () => ({ language: 'en', t: (key: string) => key }) }));
vi.mock('../lib/api', () => ({ deleteMemoryAsset: vi.fn(), updateAssetVisibility: vi.fn() }));
vi.mock('react-router-dom', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <a {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
  useParams: () => ({ memoryId: 'memory-1' }),
}));
vi.mock('../components/DerivativeImage', () => ({
  DerivativeImage: ({ src, alt, onClick }: { src: string; alt: string; onClick?: () => void }) => <img className="derivative-image-test" src={src} alt={alt} onClick={onClick} />,
}));
vi.mock('../components/ImageLightbox', () => ({
  ImageLightbox: ({ asset }: { asset: { previewUrl: string } }) => <div role="dialog" data-preview={asset.previewUrl} />,
}));

import { MemoryDetailPage } from './MemoryDetailPage';

const ownerImage = {
  id: 'image-owner', type: 'image' as const, thumbnailUrl: '/thumb-owner', previewUrl: '/preview-owner',
  originalUrl: '/original-owner', filename: 'owner.jpg',
  mimeType: 'image/jpeg', sizeBytes: 1, sortOrder: 0, visibility: 'private' as const,
};
const guestImage = { ...ownerImage, id: 'image-guest', thumbnailUrl: '/thumb-guest', previewUrl: '/preview-guest', originalUrl: null, filename: 'guest.jpg' };
const memory: Memory = {
  id: 'memory-1', title: 'Trip', location: 'NY', date: '2026-07-20', description: '', category: 'Travel',
  visibility: 'private', featured: false, status: 'published', coverAssetId: ownerImage.id,
  assets: [ownerImage, guestImage], createdAt: '', updatedAt: '',
};

const roots: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];
afterEach(() => {
  for (const { root, container } of roots.splice(0)) { act(() => root.unmount()); container.remove(); }
});

function renderDetail(isOwner: boolean) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push({ root, container });
  act(() => root.render(<MemoryDetailPage memories={[memory]} isLoading={false} isOwner={isOwner} />));
  return container;
}

describe('MemoryDetailPage image delivery', () => {
  it('renders image gallery items through thumbnails and omits guest originals', () => {
    const container = renderDetail(false);
    expect(container.querySelector('img[src="/thumb-owner"]')).not.toBeNull();
    expect(container.querySelector('img[src="/thumb-guest"]')).not.toBeNull();
    expect(container.querySelector('a[href="/original-owner"]')).toBeNull();
    expect(container.querySelectorAll('a[download]')).toHaveLength(0);
  });

  it('offers an owner original download only when originalUrl exists', () => {
    const container = renderDetail(true);
    expect(container.querySelector('a[href="/original-owner"]')).not.toBeNull();
    expect(container.querySelector('a[href="/original-owner"]')?.getAttribute('download')).toBe('owner.jpg');
    expect(container.querySelector('a[href="/preview-guest"]')).toBeNull();
    expect(container.querySelectorAll('a[download]')).toHaveLength(1);
  });

  it('opens the selected image in a lightbox using its preview URL', () => {
    const container = renderDetail(false);
    const image = container.querySelector('img[src="/thumb-owner"]');
    act(() => image?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.querySelector('[role="dialog"]')?.getAttribute('data-preview')).toBe('/preview-owner');
  });
});
