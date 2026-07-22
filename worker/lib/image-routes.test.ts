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

  it('matches generic asset aliases for the Release 2 cutover', () => {
    expect(matchImageRoute('/api/assets/a')).toEqual({
      action: 'legacy-asset',
      assetId: 'a',
    });
    expect(matchImageRoute('/api/assets/a/download')).toEqual({
      action: 'legacy-download',
      assetId: 'a',
    });
  });

  it('does not claim unrelated routes', () => {
    expect(matchImageRoute('/api/memories')).toBeNull();
  });
});
