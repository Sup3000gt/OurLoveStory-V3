import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Memory } from '../../shared/contracts';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const queryClientMock = vi.hoisted(() => ({
  getQueriesData: vi.fn(() => []),
  invalidateQueries: vi.fn(),
  setQueriesData: vi.fn(),
  setQueryData: vi.fn(),
}));

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: vi.fn() }) }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
  useQueryClient: () => queryClientMock,
}));
vi.mock('../hooks/useUploadSessions', () => ({ activeAppendSessionForMemory: () => null, useUploadSessions: () => ({ data: [] }) }));
vi.mock('../i18n/useTranslation', () => ({ useTranslation: () => ({ language: 'en', t: (key: string) => key }) }));
vi.mock('../lib/api', () => ({
  clearTimelineCover: vi.fn(),
  deleteMemoryAsset: vi.fn(),
  setTimelineCover: vi.fn(),
  updateAssetVisibility: vi.fn(),
}));
vi.mock('react-router-dom', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <a {...props}>{children}</a>,
  useLocation: () => ({ search: window.location.search }),
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
import {
  clearTimelineCover,
  setTimelineCover,
  updateAssetVisibility,
} from '../lib/api';

const ownerImage = {
  id: 'image-owner', type: 'image' as const, thumbnailUrl: '/thumb-owner', previewUrl: '/preview-owner',
  originalUrl: '/original-owner', filename: 'owner.jpg',
  mimeType: 'image/jpeg', sizeBytes: 1, sortOrder: 0, visibility: 'private' as const,
};
const guestImage = { ...ownerImage, id: 'image-guest', thumbnailUrl: '/thumb-guest', previewUrl: '/preview-guest', originalUrl: null, filename: 'guest.jpg', visibility: 'public' as const };
const video = { ...ownerImage, id: 'video-public', type: 'video' as const, thumbnailUrl: '/thumb-video', previewUrl: '/preview-video', downloadUrl: '/download-video', url: '/video', filename: 'video.mp4', mimeType: 'video/mp4', visibility: 'public' as const };
const memory: Memory = {
  id: 'memory-1', title: 'Trip', location: 'NY', date: '2026-07-20', description: '', category: 'Travel',
  visibility: 'private', featured: false, status: 'published', coverAssetId: ownerImage.id,
  assets: [ownerImage, guestImage], createdAt: '', updatedAt: '',
};
const memoryWithVideo: Memory = { ...memory, assets: [ownerImage, guestImage, video] };

const roots: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];
afterEach(() => {
  for (const { root, container } of roots.splice(0)) { act(() => root.unmount()); container.remove(); }
  window.history.replaceState({}, '', '/memory/memory-1');
  vi.clearAllMocks();
});

function renderDetail(isOwner: boolean, detail: Memory = memory) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push({ root, container });
  act(() => root.render(<MemoryDetailPage memories={[detail]} isLoading={false} isOwner={isOwner} />));
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

  it('opens the public image selected by the asset query parameter on first render', () => {
    window.history.replaceState({}, '', '/memory/memory-1?asset=image-guest');

    const container = renderDetail(false);

    expect(container.querySelector('[role="dialog"]')?.getAttribute('data-preview')).toBe('/preview-guest');
  });

  it.each(['missing-image', 'image-owner'])('does not open a lightbox for an unknown or private asset query (%s)', (assetId) => {
    window.history.replaceState({}, '', `/memory/memory-1?asset=${assetId}`);

    const container = renderDetail(true);

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows timeline-cover controls only for an owner public image asset', () => {
    const container = renderDetail(true, memoryWithVideo);

    expect(container.querySelectorAll('[data-timeline-cover-controls]')).toHaveLength(1);
    expect(container.querySelector('[data-timeline-cover-controls="image-guest"]')).not.toBeNull();
    expect(container.querySelector('[data-timeline-cover-controls="image-owner"]')).toBeNull();
    expect(container.querySelector('[data-timeline-cover-controls="video-public"]')).toBeNull();
  });

  it('sets year and month covers using the periods derived from the memory date', async () => {
    vi.mocked(setTimelineCover).mockResolvedValue({ periodType: 'year', periodKey: '2026', assetId: 'image-guest' });
    const container = renderDetail(true);

    const controls = container.querySelector('[data-timeline-cover-controls="image-guest"]')!;
    const buttons = controls.querySelectorAll<HTMLButtonElement>('button');

    await act(async () => { buttons[0]?.click(); });
    await act(async () => { buttons[1]?.click(); });

    expect(setTimelineCover).toHaveBeenNthCalledWith(1, { periodType: 'year', periodKey: '2026', assetId: 'image-guest' }, expect.any(Function));
    expect(setTimelineCover).toHaveBeenNthCalledWith(2, { periodType: 'month', periodKey: '2026-07', assetId: 'image-guest' }, expect.any(Function));
  });

  it('clears year and month covers, invalidates the timeline, and leaves other asset state untouched', async () => {
    vi.mocked(clearTimelineCover).mockResolvedValue(undefined);
    const container = renderDetail(true);
    const controls = container.querySelector('[data-timeline-cover-controls="image-guest"]')!;
    const buttons = controls.querySelectorAll<HTMLButtonElement>('button');

    await act(async () => { buttons[2]?.click(); });
    await act(async () => { buttons[3]?.click(); });

    expect(clearTimelineCover).toHaveBeenNthCalledWith(1, 'year', '2026', expect.any(Function));
    expect(clearTimelineCover).toHaveBeenNthCalledWith(2, 'month', '2026-07', expect.any(Function));
    expect(queryClientMock.invalidateQueries).toHaveBeenCalledTimes(2);
    expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['timeline'] });
    expect(updateAssetVisibility).not.toHaveBeenCalled();
    expect(memory.coverAssetId).toBe('image-owner');
    expect(container.querySelector('[data-timeline-cover-controls="image-guest"]')).not.toBeNull();
  });
});
