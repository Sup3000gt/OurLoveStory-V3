import { afterEach, describe, expect, it, vi } from 'vitest';
import { scheduleWhenIdle } from './idle';

describe('scheduleWhenIdle', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'requestIdleCallback');
    Reflect.deleteProperty(window, 'cancelIdleCallback');
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

  it('cancels a pending idle callback before it can run', () => {
    const callback = vi.fn();
    let cancelled = false;
    let run: (() => void) | undefined;
    const requestIdleCallback = vi.fn((next: () => void) => {
      run = () => {
        if (!cancelled) next();
      };
      return 2;
    });
    const cancelIdleCallback = vi.fn(() => {
      cancelled = true;
    });
    Object.assign(window, { requestIdleCallback, cancelIdleCallback });

    const cancel = scheduleWhenIdle(callback);
    cancel();
    run?.();

    expect(cancelIdleCallback).toHaveBeenCalledWith(2);
    expect(callback).not.toHaveBeenCalled();
  });
});
