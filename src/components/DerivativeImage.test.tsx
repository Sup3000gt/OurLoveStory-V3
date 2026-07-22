import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { DerivativeImage } from './DerivativeImage';

const roots: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

afterEach(() => {
  for (const { root, container } of roots.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

function render(props: React.ComponentProps<typeof DerivativeImage>) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push({ root, container });
  act(() => root.render(<DerivativeImage {...props} />));
  return container;
}

describe('DerivativeImage', () => {
  it('starts with the derivative source and never assigns originalUrl to img src', () => {
    const container = render({
      src: '/preview',
      alt: 'A memory',
      originalUrl: '/original-secret',
    });

    expect(container.querySelector('img')?.getAttribute('src')).toBe('/preview');
    expect(container.querySelector('img')?.getAttribute('src')).not.toBe('/original-secret');
  });

  it('shows a safe error and Retry action after an image error', () => {
    const container = render({ src: '/preview', alt: 'A memory' });
    act(() => container.querySelector('img')?.dispatchEvent(new Event('error')));

    expect(container.textContent).toContain('This image is unavailable.');
    expect(container.textContent).toContain('Retry');
  });

  it('preserves the owner download link in the error state', () => {
    const container = render({
      src: '/preview',
      alt: 'A memory',
      originalUrl: '/original',
      originalFilename: 'memory.jpg',
      downloadLabel: 'Download original',
    });
    act(() => container.querySelector('img')?.dispatchEvent(new Event('error')));

    expect(container.querySelector('a[href="/original"]')).not.toBeNull();
  });
});
