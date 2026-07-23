import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { GallerySearchBar } from './GallerySearchBar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('GallerySearchBar', () => {
  let root: ReturnType<typeof createRoot> | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
  });

  it('renders a labelled searchbox and emits the debounced query', async () => {
    const onChange = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(
      <LanguageProvider>
        <GallerySearchBar value="" onChange={onChange} onClear={vi.fn()} />
      </LanguageProvider>,
    ));

    const input = container.querySelector('input[type="search"]') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('Search titles, places, or notes');

    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      setValue?.call(input, '韩餐');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    });

    expect(onChange).toHaveBeenLastCalledWith('韩餐');
  });

  it('keeps the latest typed value during debounce and limits the query length', () => {
    const onChange = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(
      <LanguageProvider>
        <GallerySearchBar value="" onChange={onChange} onClear={vi.fn()} />
      </LanguageProvider>,
    ));

    const input = container.querySelector('input[type="search"]') as HTMLInputElement;
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      setValue?.call(input, '正在输入');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    act(() => root?.render(
      <LanguageProvider>
        <GallerySearchBar value="" onChange={onChange} onClear={vi.fn()} />
      </LanguageProvider>,
    ));

    expect(input.value).toBe('正在输入');
    expect(input.maxLength).toBe(80);
  });

  it('uses the latest change callback after a parent rerender during debounce', async () => {
    const initialOnChange = vi.fn();
    const latestOnChange = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(
      <LanguageProvider>
        <GallerySearchBar value="" onChange={initialOnChange} onClear={vi.fn()} />
      </LanguageProvider>,
    ));

    const input = container.querySelector('input[type="search"]') as HTMLInputElement;
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      setValue?.call(input, '韩餐');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    act(() => root?.render(
      <LanguageProvider>
        <GallerySearchBar value="" onChange={latestOnChange} onClear={vi.fn()} />
      </LanguageProvider>,
    ));

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    });

    expect(initialOnChange).not.toHaveBeenCalled();
    expect(latestOnChange).toHaveBeenLastCalledWith('韩餐');
  });
});
