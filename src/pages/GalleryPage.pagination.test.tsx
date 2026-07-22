import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../i18n/LanguageProvider';
import { GalleryPage } from './GalleryPage';

describe('GalleryPage pagination', () => {
  let root: ReturnType<typeof createRoot> | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
  });

  it('shows and triggers Load more when another page is available', () => {
    const loadMore = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(
      <LanguageProvider>
        <GalleryPage
          memories={[]}
          isLoading={false}
          error={null}
          isOwner={false}
          hasNextPage
          isFetchingNextPage={false}
          onLoadMore={loadMore}
        />
      </LanguageProvider>,
    ));

    const button = Array.from(container.querySelectorAll('button'))
      .find((item) => item.textContent?.includes('Load more'));
    expect(button).toBeTruthy();

    act(() => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(loadMore).toHaveBeenCalledOnce();
  });
});
