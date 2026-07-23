import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareLinkButton } from './ShareLinkButton';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ShareLinkButton', () => {
  let root: ReturnType<typeof createRoot> | undefined;
  let container: HTMLDivElement | undefined;

  function renderButton() {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(
      <ShareLinkButton
        title="April memories"
        url="https://lucyandalan.com/timeline/2026-04"
        label="Share"
        copiedLabel="Link copied"
        fallbackLabel="Copy link manually"
      />,
    ));
    return container;
  }

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    vi.unstubAllGlobals();
  });

  it('announces a copied link after the clipboard fallback succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const page = renderButton();

    await act(async () => {
      page.querySelector<HTMLButtonElement>('button')?.click();
    });

    expect(writeText).toHaveBeenCalledWith('https://lucyandalan.com/timeline/2026-04');
    expect(page.querySelector('[aria-live="polite"]')?.textContent).toBe('Link copied');
  });

  it('reveals a read-only, selected URL field when sharing cannot complete', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const page = renderButton();

    await act(async () => {
      page.querySelector<HTMLButtonElement>('button')?.click();
    });

    const input = page.querySelector<HTMLInputElement>('input[readonly]');
    expect(input?.value).toBe('https://lucyandalan.com/timeline/2026-04');
    expect(document.activeElement).toBe(input);
    expect(page.querySelector('[aria-live="polite"]')?.textContent).toBe('Copy link manually');
  });
});
