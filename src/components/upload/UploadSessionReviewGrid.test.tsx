import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  canMoveReviewFile,
  dragDirection,
} from './UploadSessionReviewGrid';

describe('Review grid helpers', () => {
  it('prevents moving the first included item up', () => {
    expect(
      canMoveReviewFile(
        0,
        3,
        'up',
      ),
    ).toBe(false);
  });

  it('allows moving the first included item down', () => {
    expect(
      canMoveReviewFile(
        0,
        3,
        'down',
      ),
    ).toBe(true);
  });

  it('maps drag indices to a movement direction', () => {
    expect(
      dragDirection(2, 0),
    ).toBe('up');

    expect(
      dragDirection(0, 2),
    ).toBe('down');

    expect(
      dragDirection(1, 1),
    ).toBeNull();
  });
});