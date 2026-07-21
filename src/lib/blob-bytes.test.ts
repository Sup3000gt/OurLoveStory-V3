import { describe, expect, it, vi } from 'vitest';
import { readBlobAsArrayBuffer } from './blob-bytes';

describe('readBlobAsArrayBuffer', () => {
  it('reads a jsdom File when Blob.arrayBuffer is unavailable', async () => {
    const file = new File(['hello'], 'hello.jpg', {
      type: 'image/jpeg',
    });

    const result = await readBlobAsArrayBuffer(file);

    expect(
      Array.from(new Uint8Array(result)),
    ).toEqual([104, 101, 108, 108, 111]);
  });

  it('uses a native arrayBuffer implementation when available', async () => {
    const expected = new Uint8Array([1, 2, 3]).buffer;
    const arrayBuffer = vi.fn().mockResolvedValue(expected);
    const blob = {
      arrayBuffer,
    } as unknown as Blob;

    await expect(
      readBlobAsArrayBuffer(blob),
    ).resolves.toBe(expected);

    expect(arrayBuffer).toHaveBeenCalledOnce();
  });
});