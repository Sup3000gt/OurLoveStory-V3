import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Memory } from '../../shared/contracts';
import { LanguageProvider } from '../i18n/LanguageProvider';
import { TimelineMonthPage } from './TimelineMonthPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const memory: Memory = {
  id: 'memory-april',
  title: 'A spring day',
  location: 'Paris',
  date: '2025-04-03',
  description: 'A quiet afternoon.',
  category: 'Travel',
  visibility: 'public',
  featured: false,
  status: 'published',
  coverAssetId: 'asset-april',
  assets: [{
    id: 'asset-april',
    type: 'image',
    thumbnailUrl: '/thumbnail-april',
    previewUrl: '/preview-april',
    originalUrl: null,
    filename: 'april.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1,
    sortOrder: 0,
    visibility: 'public',
  }],
  createdAt: '2025-04-03T00:00:00Z',
  updatedAt: '2025-04-03T00:00:00Z',
};

const { useTimelineMonth } = vi.hoisted(() => ({ useTimelineMonth: vi.fn() }));

vi.mock('../hooks/useTimelineMonth', () => ({ useTimelineMonth }));

describe('TimelineMonthPage', () => {
  let root: ReturnType<typeof createRoot> | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    useTimelineMonth.mockReset();
  });

  it('shows the month archive and paginates its memory cards', () => {
    useTimelineMonth.mockReturnValue({
      data: { pages: [{ memories: [memory], nextCursor: 'cursor-2' }] },
      isLoading: false,
      error: null,
      hasNextPage: true,
      isFetchingNextPage: false,
    });

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(
      <LanguageProvider>
        <MemoryRouter initialEntries={['/timeline/2025-04']}>
          <Routes>
            <Route path="/timeline/:monthKey" element={<TimelineMonthPage />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>,
    ));

    expect(container.querySelector('h1')?.textContent).toBe('April 2025');
    expect(container.textContent).toContain('A spring day');
    expect(container.querySelector('a[href="/memory/memory-april"]')).not.toBeNull();
    expect(container.textContent).toContain('Page 1');
    expect(Array.from(container.querySelectorAll('button'))
      .some((button) => button.textContent?.includes('Next page'))).toBe(true);
  });
});
