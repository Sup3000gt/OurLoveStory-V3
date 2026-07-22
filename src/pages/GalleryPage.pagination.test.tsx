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

  it('shows page navigation instead of appending a Load more list', () => {
    const previousPage = vi.fn();
    const nextPage = vi.fn();
    const categoryChange = vi.fn();
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
          category="All"
          currentPage={1}
          totalPages={2}
          hasPreviousPage={false}
          hasNextPage
          isFetchingPage={false}
          onPreviousPage={previousPage}
          onNextPage={nextPage}
          onCategoryChange={categoryChange}
        />
      </LanguageProvider>,
    ));

    expect(container.textContent).toContain('Page 1');
    expect(container.textContent).not.toContain('Load more');

    const button = Array.from(container.querySelectorAll('button'))
      .find((item) => item.textContent?.includes('Next page'));
    expect(button).toBeTruthy();

    act(() => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(nextPage).toHaveBeenCalledOnce();
    expect(previousPage).not.toHaveBeenCalled();
  });

  it('asks the parent to load a category from its first page', () => {
    const categoryChange = vi.fn();
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
          category="All"
          currentPage={2}
          totalPages={2}
          hasPreviousPage
          hasNextPage={false}
          isFetchingPage={false}
          onPreviousPage={vi.fn()}
          onNextPage={vi.fn()}
          onCategoryChange={categoryChange}
        />
      </LanguageProvider>,
    ));

    const button = Array.from(container.querySelectorAll('button'))
      .find((item) => item.textContent?.includes('Travel'));

    act(() => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(categoryChange).toHaveBeenCalledWith('Travel');
  });
});
