import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareLink } from './share-link';

describe('shareLink', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses Web Share API when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });

    await expect(shareLink({
      title: 'April memories',
      url: 'https://lucyandalan.com/timeline/2026-04',
    })).resolves.toBe('shared');

    expect(share).toHaveBeenCalledWith({
      title: 'April memories',
      text: 'April memories',
      url: 'https://lucyandalan.com/timeline/2026-04',
    });
  });

  it('copies the URL when Web Share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(shareLink({
      title: '2026',
      url: 'https://lucyandalan.com/timeline#year-2026',
    })).resolves.toBe('copied');

    expect(writeText).toHaveBeenCalledWith(
      'https://lucyandalan.com/timeline#year-2026',
    );
  });

  it('treats a cancelled Web Share dialog as a quiet manual fallback', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    vi.stubGlobal('navigator', { share });

    await expect(shareLink({
      title: 'April memories',
      url: 'https://lucyandalan.com/timeline/2026-04',
    })).resolves.toBe('manual');
  });

  it('returns manual when copying is unavailable or fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(shareLink({
      title: '2026',
      url: 'https://lucyandalan.com/timeline#year-2026',
    })).resolves.toBe('manual');
  });
});
