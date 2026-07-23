import { afterEach, describe, expect, it, vi } from 'vitest';
import { scheduleWhenIdle } from './idle';

describe('scheduleWhenIdle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses requestIdleCallback when the browser provides it', () => {
    const callback = vi.fn();
    const requestIdleCallback = vi.fn((run: () => void) => {
      run();
      return 1;
    });
    Object.assign(window, { requestIdleCallback });

    scheduleWhenIdle(callback);

    expect(requestIdleCallback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledOnce();
  });
});
