import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../i18n/LanguageProvider';
import App from '../App';
import { Header } from './Header';

const { useMemories, useOwnerSession, useTimeline } = vi.hoisted(() => ({
  useMemories: vi.fn(),
  useOwnerSession: vi.fn(),
  useTimeline: vi.fn(),
}));

vi.mock('@clerk/react', () => ({
  Show: ({ children }: { children: ReactNode }) => children,
  SignInButton: ({ children }: { children: ReactNode }) => children,
  UserButton: () => null,
}));
vi.mock('../hooks/useMemories', () => ({ useMemories }));
vi.mock('../hooks/useOwnerSession', () => ({ useOwnerSession }));
vi.mock('../hooks/useTimeline', () => ({ useTimeline }));
vi.mock('../contexts/PhotoSessionUploadContext', () => ({
  PhotoSessionUploadProvider: ({ children }: { children: ReactNode }) => children,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Header', () => {
  let root: ReturnType<typeof createRoot> | undefined;
  let container: HTMLDivElement | undefined;

  function renderHeader(isOwner: boolean) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(
      <LanguageProvider>
        <MemoryRouter>
          <Header isOwner={isOwner} ownerName={null} />
        </MemoryRouter>
      </LanguageProvider>,
    ));
    return container;
  }

  function renderApp(path: string) {
    window.history.replaceState({}, '', path);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(
      <LanguageProvider>
        <App />
      </LanguageProvider>,
    ));
    return container;
  }

  function unmountHeader() {
    const renderedRoot = root;
    const renderedContainer = container;
    if (renderedRoot) act(() => renderedRoot.unmount());
    renderedContainer?.remove();
    root = undefined;
    container = undefined;
  }

  afterEach(() => {
    unmountHeader();
    window.localStorage.removeItem('our-love-story-language');
    useMemories.mockReset();
    useOwnerSession.mockReset();
    useTimeline.mockReset();
  });

  it('sends Journal to the memory timeline while preserving Home and Gallery destinations', () => {
    const header = renderHeader(false);

    expect(header.querySelector('nav a[href="/"]')?.textContent).toBe('Home');
    expect(header.querySelector('nav a[href="/gallery"]')?.textContent).toBe('Gallery');
    expect(header.querySelector('nav a[href="/timeline"]')?.textContent).toBe('Journal');
  });

  it('shows the Studio destination only for an owner', () => {
    expect(renderHeader(false).querySelector('a[href="/studio"]')).toBeNull();

    unmountHeader();

    expect(renderHeader(true).querySelector('a[href="/studio"]')?.textContent).toContain('Owner Studio');
  });

  it('registers the timeline route without changing the Home or Gallery routes', () => {
    useOwnerSession.mockReturnValue({ data: { isOwner: false }, isLoading: false, error: null });
    useMemories.mockReturnValue({
      data: { pages: [{ memories: [] }] },
      isLoading: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    });
    useTimeline.mockReturnValue({ data: { years: [] }, isLoading: false, error: null });

    expect(renderApp('/timeline').querySelector('h1')?.textContent).toBe('A river of memories.');

    unmountHeader();

    expect(renderApp('/').querySelector('#journal')).toBeTruthy();

    unmountHeader();

    expect(renderApp('/gallery').querySelector('h1')?.textContent).toBe('Every memory has a place here.');
  });
});
