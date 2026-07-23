import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { emptyGalleryFilterState } from '../../lib/gallery-filters';
import { GalleryFilters } from './GalleryFilters';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('GalleryFilters', () => {
  let root: ReturnType<typeof createRoot> | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
  });

  it('disables Month until Year is selected', () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(
      <LanguageProvider>
        <GalleryFilters
          state={emptyGalleryFilterState}
          facets={{ years: [{ year: 2026, months: [5] }] }}
          onChange={vi.fn()}
          onClear={vi.fn()}
        />
      </LanguageProvider>,
    ));

    const month = container.querySelector('select[name="month"]') as HTMLSelectElement;
    expect(month.labels?.[0]?.textContent).toBe('Month');
    expect(month.disabled).toBe(true);
    expect(container.querySelector('.gallery-filter-toolbar')).not.toBeNull();
  });
});
