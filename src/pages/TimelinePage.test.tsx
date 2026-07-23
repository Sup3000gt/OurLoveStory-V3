import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TimelineResponse } from '../../shared/contracts';
import { LanguageProvider } from '../i18n/LanguageProvider';
import { TimelinePage } from './TimelinePage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const timeline: TimelineResponse = {
  years: [
    {
      key: '2025',
      label: '2025',
      photoCount: 3,
      cover: {
        memoryId: 'memory-newest',
        memoryTitle: 'Spring in Paris',
        memoryDate: '2025-05-16',
        memoryLocation: 'Paris',
        assetId: 'asset-year',
        previewUrl: 'https://images.example/year.jpg',
        thumbnailUrl: 'https://images.example/year-thumb.jpg',
        filename: 'year.jpg',
        isExplicitCover: true,
      },
      months: [
        {
          key: '2025-05',
          year: '2025',
          month: 5,
          label: 'May 2025',
          photoCount: 2,
          cover: {
            memoryId: 'memory-may',
            memoryTitle: 'A May picnic',
            memoryDate: '2025-05-11',
            memoryLocation: 'Paris',
            assetId: 'asset-may',
            previewUrl: 'https://images.example/may.jpg',
            thumbnailUrl: 'https://images.example/may-thumb.jpg',
            filename: 'may.jpg',
            isExplicitCover: false,
          },
        },
        {
          key: '2025-04',
          year: '2025',
          month: 4,
          label: 'April 2025',
          photoCount: 1,
          cover: {
            memoryId: 'memory-april',
            memoryTitle: 'Rainy afternoon',
            memoryDate: '2025-04-03',
            memoryLocation: 'Paris',
            assetId: 'asset-april',
            previewUrl: 'https://images.example/april.jpg',
            thumbnailUrl: 'https://images.example/april-thumb.jpg',
            filename: 'april.jpg',
            isExplicitCover: false,
          },
        },
        {
          key: '2025-03',
          year: '2025',
          month: 3,
          label: 'March 2025',
          photoCount: 0,
          cover: {
            memoryId: 'memory-empty',
            memoryTitle: 'Should not appear',
            memoryDate: '2025-03-01',
            memoryLocation: 'Paris',
            assetId: 'asset-empty',
            previewUrl: 'https://images.example/empty.jpg',
            thumbnailUrl: 'https://images.example/empty-thumb.jpg',
            filename: 'empty.jpg',
            isExplicitCover: false,
          },
        },
      ],
    },
    {
      key: '2024',
      label: '2024',
      photoCount: 1,
      cover: {
        memoryId: 'memory-older',
        memoryTitle: 'First autumn',
        memoryDate: '2024-10-08',
        memoryLocation: 'Boston',
        assetId: 'asset-older',
        previewUrl: 'https://images.example/older.jpg',
        thumbnailUrl: 'https://images.example/older-thumb.jpg',
        filename: 'older.jpg',
        isExplicitCover: true,
      },
      months: [],
    },
  ],
};

const { useTimeline } = vi.hoisted(() => ({ useTimeline: vi.fn() }));

vi.mock('../hooks/useTimeline', () => ({ useTimeline }));

describe('TimelinePage', () => {
  let root: ReturnType<typeof createRoot> | undefined;
  let container: HTMLDivElement | undefined;

  function renderPage() {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(
      <LanguageProvider>
        <TimelinePage />
      </LanguageProvider>,
    ));
    return container;
  }

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    window.localStorage.removeItem('our-love-story-language');
    root = undefined;
    container = undefined;
    useTimeline.mockReset();
  });

  it('renders newest-first year and month labels with shared 3 / 2 preview frames', () => {
    useTimeline.mockReturnValue({ data: timeline, isLoading: false, error: null });

    const page = renderPage();
    const labels = Array.from(page.querySelectorAll('[data-timeline-period-label]'))
      .map((element) => element.textContent);

    expect(labels).toEqual(['2025', 'May 2025', 'April 2025', '2024']);
    expect(page.querySelectorAll('.timeline-year-card .timeline-preview-frame')).toHaveLength(2);
    expect(page.querySelectorAll('.timeline-month-card .timeline-preview-frame')).toHaveLength(2);
    expect(page.querySelectorAll('.timeline-preview-frame[data-preview-ratio="3:2"]')).toHaveLength(4);
  });

  it('links every cover to its exact memory asset and omits empty cards and extra copy', () => {
    useTimeline.mockReturnValue({ data: timeline, isLoading: false, error: null });

    const page = renderPage();
    const links = Array.from(page.querySelectorAll<HTMLAnchorElement>('.timeline-cover-link'));

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/memory/memory-newest?asset=asset-year',
      '/memory/memory-may?asset=asset-may',
      '/memory/memory-april?asset=asset-april',
      '/memory/memory-older?asset=asset-older',
    ]);
    expect(Array.from(page.querySelectorAll<HTMLAnchorElement>('.timeline-month-archive-link'))
      .map((link) => link.getAttribute('href'))).toEqual([
        '/timeline/2025-05',
        '/timeline/2025-04',
      ]);
    expect(page.textContent).not.toContain('Birthday');
    expect(page.textContent).not.toContain('Should not appear');
    expect(page.textContent).not.toContain('Rainy afternoon');
  });

  it('keeps the preview URL while applying the portrait-safe crop after image load', () => {
    useTimeline.mockReturnValue({ data: timeline, isLoading: false, error: null });

    const page = renderPage();
    const image = page.querySelector<HTMLImageElement>('img[src="https://images.example/year.jpg"]');
    expect(image).toBeTruthy();
    Object.defineProperties(image!, {
      naturalWidth: { configurable: true, value: 600 },
      naturalHeight: { configurable: true, value: 1200 },
    });

    act(() => image?.dispatchEvent(new Event('load', { bubbles: true })));

    expect(image?.classList.contains('timeline-preview--portrait')).toBe(true);
    expect(image?.getAttribute('src')).toBe('https://images.example/year.jpg');
    expect(image?.getAttribute('loading')).toBe('eager');
    expect(page.querySelector('img[src="https://images.example/may.jpg"]')?.getAttribute('loading')).toBe('lazy');
  });

  it('localizes photo counts in Chinese', () => {
    window.localStorage.setItem('our-love-story-language', 'zh');
    useTimeline.mockReturnValue({ data: timeline, isLoading: false, error: null });

    const page = renderPage();

    expect(page.textContent).toContain('3 张照片');
    expect(page.textContent).toContain('1 张照片');
  });

  it('localizes month labels in Chinese', () => {
    window.localStorage.setItem('our-love-story-language', 'zh');
    useTimeline.mockReturnValue({ data: timeline, isLoading: false, error: null });

    const page = renderPage();

    expect(page.textContent).toContain('2025年5月');
    expect(page.textContent).not.toContain('May 2025');
  });
});
