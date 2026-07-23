import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TimelineYear } from '../../shared/contracts';
import { LanguageProvider } from '../i18n/LanguageProvider';
import { TimelineYearNav } from './TimelineYearNav';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const years = [
  { key: '2026', label: '2026', photoCount: 1, months: [] },
  { key: '2025', label: '2025', photoCount: 1, months: [] },
] as unknown as TimelineYear[];

describe('TimelineYearNav', () => {
  let root: ReturnType<typeof createRoot> | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    window.history.replaceState(null, '', '/');
    root = undefined;
    container = undefined;
    vi.restoreAllMocks();
  });

  it('renders stable year anchor links and smoothly follows a matching hash', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    window.history.replaceState(null, '', '#year-2025');
    container = document.createElement('div');
    document.body.append(container);
    const target = document.createElement('section');
    target.id = 'year-2025';
    document.body.append(target);
    root = createRoot(container);

    act(() => root?.render(
      <LanguageProvider>
        <TimelineYearNav years={years} />
      </LanguageProvider>,
    ));

    expect(Array.from(container.querySelectorAll('a')).map((link) => ({
      href: link.getAttribute('href'),
      text: link.textContent,
    }))).toEqual([
      { href: '#year-2026', text: '2026' },
      { href: '#year-2025', text: '2025' },
    ]);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    target.remove();
  });
});
