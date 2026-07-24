import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  isHeicFile,
  jpegFilename,
  normalizeSelectedMediaFiles,
} from './heic-conversion';

describe('HEIC conversion', () => {
  it('detects HEIC and HEIF by MIME type or extension', () => {
    expect(isHeicFile({
      name: 'photo',
      type: 'image/heic',
    })).toBe(true);
    expect(isHeicFile({
      name: 'photo.HEIF',
      type: '',
    })).toBe(true);
    expect(isHeicFile({
      name: 'photo.jpg',
      type: 'image/jpeg',
    })).toBe(false);
  });

  it('replaces HEIC extensions with a JPEG extension', () => {
    expect(jpegFilename('IMG_0001.HEIC'))
      .toBe('IMG_0001.jpg');
    expect(jpegFilename('portrait.heif'))
      .toBe('portrait.jpg');
  });

  it('converts HEIC files sequentially and keeps selection order', async () => {
    const first = new File(
      ['first'],
      'first.heic',
      { type: 'image/heic' },
    );
    const jpeg = new File(
      ['existing'],
      'existing.jpg',
      { type: 'image/jpeg' },
    );
    const second = new File(
      ['second'],
      'second.heif',
      { type: 'image/heif' },
    );
    const calls: string[] = [];
    const convert = vi.fn(
      async (file: File) => {
        calls.push(file.name);
        return new Blob(
          [`jpeg:${file.name}`],
          { type: 'image/jpeg' },
        );
      },
    );

    const result =
      await normalizeSelectedMediaFiles(
        [first, jpeg, second],
        { convert },
      );

    expect(calls).toEqual([
      'first.heic',
      'second.heif',
    ]);
    expect(result.map((file) => [
      file.name,
      file.type,
    ])).toEqual([
      ['first.jpg', 'image/jpeg'],
      ['existing.jpg', 'image/jpeg'],
      ['second.jpg', 'image/jpeg'],
    ]);
    expect(result[1]).toBe(jpeg);
  });

  it('returns a useful error when conversion fails', async () => {
    const file = new File(
      ['broken'],
      'broken.heic',
      { type: 'image/heic' },
    );

    await expect(
      normalizeSelectedMediaFiles(
        [file],
        {
          convert: async () => {
            throw new Error('decoder failed');
          },
        },
      ),
    ).rejects.toThrow(
      'broken.heic could not be converted from HEIC',
    );
  });
});
