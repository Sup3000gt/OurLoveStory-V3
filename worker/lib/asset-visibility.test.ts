import { describe, expect, it } from 'vitest';
import { resolveVisibleCoverAssetId } from './asset-visibility';

describe('resolveVisibleCoverAssetId', () => {
  it('keeps the configured cover when it is visible', () => {
    expect(resolveVisibleCoverAssetId('asset-2', [{ id: 'asset-1' }, { id: 'asset-2' }])).toBe('asset-2');
  });

  it('falls back to the first visible asset when the configured cover is private', () => {
    expect(resolveVisibleCoverAssetId('private-cover', [{ id: 'public-1' }, { id: 'public-2' }])).toBe('public-1');
  });

  it('keeps the configured id when no visible asset exists', () => {
    expect(resolveVisibleCoverAssetId('cover', [])).toBe('cover');
  });
});
