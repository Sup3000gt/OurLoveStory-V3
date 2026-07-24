import {
  act,
} from 'react';
import {
  createRoot,
} from 'react-dom/client';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type {
  Memory,
} from '../../shared/contracts';

(globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock(
  '../i18n/useTranslation',
  () => ({
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  }),
);

import {
  MemoryEditForm,
} from './MemoryEditForm';

const memory: Memory = {
  id: 'memory-1',
  title: 'Original title',
  location: 'New York',
  date: '2026-07-20',
  description: 'Original note',
  category: 'Travel',
  visibility: 'private',
  featured: false,
  status: 'published',
  coverAssetId: 'asset-1',
  assets: [],
  createdAt: '',
  updatedAt: '',
};

const roots: Array<{
  root: ReturnType<
    typeof createRoot
  >;
  container: HTMLDivElement;
}> = [];

afterEach(() => {
  for (
    const { root, container }
    of roots.splice(0)
  ) {
    act(() => root.unmount());
    container.remove();
  }
});

describe('MemoryEditForm', () => {
  it('submits edited memory metadata', async () => {
    const onSave = vi.fn(
      async () => undefined,
    );
    const container =
      document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push({ root, container });

    act(() => {
      root.render(
        <MemoryEditForm
          memory={memory}
          busy={false}
          error=""
          onCancel={() => undefined}
          onSave={onSave}
        />,
      );
    });

    const title =
      container.querySelector<HTMLInputElement>(
        'input[name="title"]',
      )!;
    const description =
      container.querySelector<HTMLTextAreaElement>(
        'textarea[name="description"]',
      )!;
    const featured =
      container.querySelector<HTMLInputElement>(
        'input[name="featured"]',
      )!;

    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(
        title,
        'Updated title',
      );
      title.dispatchEvent(
        new Event(
          'input',
          { bubbles: true },
        ),
      );
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )!.set!.call(
        description,
        'Updated note',
      );
      description.dispatchEvent(
        new Event(
          'input',
          { bubbles: true },
        ),
      );
      featured.click();
    });
    await act(async () => {
      container
        .querySelector<HTMLFormElement>(
          'form',
        )!
        .requestSubmit();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Updated title',
        description: 'Updated note',
        featured: true,
        status: 'published',
      }),
    );
  });
});
