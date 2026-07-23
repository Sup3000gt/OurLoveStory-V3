import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { emptyGalleryFilterState } from '../../lib/gallery-filters';
import { MobileFilterSheet } from './MobileFilterSheet';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('MobileFilterSheet', () => {
  let root: ReturnType<typeof createRoot> | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
  });

  it('applies mobile draft filters only after Apply', () => {
    const onApply = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(
      <LanguageProvider>
        <MobileFilterSheet
          state={emptyGalleryFilterState}
          facets={{ years: [{ year: 2026, months: [5] }] }}
          onApply={onApply}
        />
      </LanguageProvider>,
    ));

    const trigger = container.querySelector('button') as HTMLButtonElement;
    expect(trigger.textContent).toContain('Filters');
    act(() => trigger.click());

    const year = container.querySelector('select[name="year"]') as HTMLSelectElement;
    act(() => {
      year.value = '2026';
      year.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onApply).not.toHaveBeenCalled();

    const apply = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Apply filters')) as HTMLButtonElement;
    act(() => apply.click());

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ year: '2026' }));
  });

  it('closes on Escape without applying and returns focus to the trigger', async () => {
    const onApply = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(
      <LanguageProvider>
        <MobileFilterSheet
          state={emptyGalleryFilterState}
          facets={{ years: [{ year: 2026, months: [5] }] }}
          onApply={onApply}
        />
      </LanguageProvider>,
    ));

    const trigger = container.querySelector('button') as HTMLButtonElement;
    act(() => trigger.click());

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    act(() => dialog.dispatchEvent(new Event('cancel', { cancelable: true })));
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(onApply).not.toHaveBeenCalled();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });
});
