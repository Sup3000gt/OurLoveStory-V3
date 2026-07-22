import { describe, expect, it } from 'vitest';
import { matchImageRoute } from './image-routes';

describe('image route matching', () => {
  it('matches the Release 1 asset derivative and original routes', () => {
    expect(matchImageRoute('/api/assets/a/thumbnail')).toEqual({
      action: 'derivative',
      assetId: 'a',
      variant: 'thumbnail',
    });
    expect(matchImageRoute('/api/assets/a/preview')).toEqual({
      action: 'derivative',
      assetId: 'a',
      variant: 'preview',
    });
    expect(matchImageRoute('/api/assets/a/original')).toEqual({
      action: 'original',
      assetId: 'a',
    });
  });

  it('matches both internal signed source route shapes', () => {
    expect(matchImageRoute('/api/internal/image-source/assets/a')).toEqual({
      action: 'internal-asset-source',
      assetId: 'a',
    });
    expect(matchImageRoute('/api/internal/image-source/upload-sessions/s/files/f')).toEqual({
      action: 'internal-session-source',
      sessionId: 's',
      fileId: 'f',
    });
  });

  it('does not claim legacy or unrelated routes', () => {
    expect(matchImageRoute('/api/assets/a')).toBeNull();
    expect(matchImageRoute('/api/assets/a/download')).toBeNull();
    expect(matchImageRoute('/api/memories')).toBeNull();
  });
});
