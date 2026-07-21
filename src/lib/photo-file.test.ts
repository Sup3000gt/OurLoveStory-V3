import { describe, expect, it } from 'vitest';
import {
  classifySelection,
  normalizeLocalMediaMime,
} from './photo-file';

function photo(
  name = 'photo.jpg',
  type = 'image/jpeg',
  size = 10,
): File {
  return new File(['x'.repeat(size)], name, { type });
}

describe('normalizeLocalMediaMime', () => {
  it('normalizes supplied MIME casing', () => {
    expect(
      normalizeLocalMediaMime({
        name: 'PHOTO.JPG',
        type: 'IMAGE/JPEG',
      }),
    ).toBe('image/jpeg');
  });
});

describe('classifySelection', () => {
  it('accepts one hundred pure photos', () => {
    const files = Array.from(
      { length: 100 },
      (_, index) => photo(`${index}.jpg`),
    );

    expect(classifySelection(files)).toEqual({
      mode: 'photo-session',
    });
  });

  it('rejects one hundred and one pure photos', () => {
    const files = Array.from(
      { length: 101 },
      (_, index) => photo(`${index}.jpg`),
    );

    expect(() => classifySelection(files)).toThrow('100');
  });

  it('uses the legacy path when a supported video is present', () => {
    const result = classifySelection([
      photo(),
      new File(['video'], 'clip.mp4', {
        type: 'video/mp4',
      }),
    ]);

    expect(result).toEqual({ mode: 'legacy-media' });
  });

  it('rejects unsupported files', () => {
    expect(() =>
      classifySelection([
        new File(['pdf'], 'file.pdf', {
          type: 'application/pdf',
        }),
      ]),
    ).toThrow('unsupported');
  });
});