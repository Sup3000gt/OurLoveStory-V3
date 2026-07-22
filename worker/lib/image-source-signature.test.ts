import { describe, expect, it } from 'vitest';
import {
  canonicalImageSource,
  signImageSource,
  signedImageSourceUrl,
  verifyImageSourceSignature,
} from './image-source-signature';

const secret = 'test-image-source-secret';
const pathname = '/api/internal/image-source/assets/asset-1';

describe('image source signatures', () => {
  it('builds the canonical payload from the path and expiry', () => {
    expect(canonicalImageSource(pathname, 1_750_000_000)).toBe(`${pathname}\n1750000000`);
  });

  it('verifies a valid HMAC signature and rejects a changed path', async () => {
    const signature = await signImageSource(secret, pathname, 1_750_000_060);

    await expect(
      verifyImageSourceSignature(secret, pathname, 1_750_000_060, signature, 1_750_000_000),
    ).resolves.toBe(true);
    await expect(
      verifyImageSourceSignature(
        secret,
        `${pathname}/changed`,
        1_750_000_060,
        signature,
        1_750_000_000,
      ),
    ).resolves.toBe(false);
  });

  it('rejects expired and overlong signatures', async () => {
    const expired = await signImageSource(secret, pathname, 1_750_000_000);
    const overlong = await signImageSource(secret, pathname, 1_750_000_061);

    await expect(
      verifyImageSourceSignature(secret, pathname, 1_750_000_000, expired, 1_750_000_000),
    ).resolves.toBe(false);
    await expect(
      verifyImageSourceSignature(secret, pathname, 1_750_000_061, overlong, 1_750_000_000),
    ).resolves.toBe(false);
  });

  it('creates a short-lived URL containing only expiry and signature', async () => {
    const result = await signedImageSourceUrl(
      'https://example.com',
      pathname,
      secret,
      1_750_000_000,
    );
    const url = new URL(result.url);

    expect(result.expires).toBe(1_750_000_060);
    expect(result.signature).toBe(url.searchParams.get('signature'));
    expect(url.pathname).toBe(pathname);
    expect(url.searchParams.get('expires')).toBe('1750000060');
    expect(url.search).not.toContain(secret);
    await expect(
      verifyImageSourceSignature(
        secret,
        url.pathname,
        Number(url.searchParams.get('expires')),
        url.searchParams.get('signature') ?? '',
        1_750_000_000,
      ),
    ).resolves.toBe(true);
  });
});
