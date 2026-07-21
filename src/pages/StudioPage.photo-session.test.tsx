import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  chooseStudioSelectionMode,
} from './StudioPage';

describe('Studio selection routing', () => {
  it('routes pure photos to Upload Sessions', () => {
    expect(
      chooseStudioSelectionMode([
        new File(
          ['one'],
          'one.jpg',
          {
            type: 'image/jpeg',
          },
        ),
        new File(
          ['two'],
          'two.png',
          {
            type: 'image/png',
          },
        ),
      ]),
    ).toBe('photo-session');
  });

  it('routes a selection containing video to legacy media', () => {
    expect(
      chooseStudioSelectionMode([
        new File(
          ['one'],
          'one.jpg',
          {
            type: 'image/jpeg',
          },
        ),
        new File(
          ['video'],
          'clip.mp4',
          {
            type: 'video/mp4',
          },
        ),
      ]),
    ).toBe('legacy-media');
  });

  it('keeps the twenty-file limit when video is present', () => {
    const files = [
      new File(
        ['video'],
        'clip.mp4',
        {
          type: 'video/mp4',
        },
      ),
      ...Array.from(
        { length: 20 },
        (_, index) =>
          new File(
            ['photo'],
            `${index}.jpg`,
            {
              type: 'image/jpeg',
            },
          ),
      ),
    ];

    expect(() =>
      chooseStudioSelectionMode(
        files,
      ),
    ).toThrow('20');
  });
});