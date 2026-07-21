import { describe, expect, it } from 'vitest';
import type {
  UploadSessionSummary,
} from '../../../shared/contracts';
import {
  sessionRecoveryAction,
  sessionRecoveryProgress,
} from './ActiveUploadSessions';

function summary(
  status: UploadSessionSummary['status'],
): UploadSessionSummary {
  return {
    id: 'session-a',
    kind: 'create',
    memoryId: null,
    title: 'Trip',
    expectedFileCount: 10,
    completedFileCount: 4,
    status,
    updatedAt:
      '2026-07-21T00:00:00.000Z',
    expiresAt:
      '2026-07-28T00:00:00.000Z',
  };
}

describe('Active Upload Sessions helpers', () => {
  it('uses Review for a review-ready Session', () => {
    expect(
      sessionRecoveryAction(
        summary('review'),
      ),
    ).toBe('review');
  });

  it('uses Resume for an uploading Session', () => {
    expect(
      sessionRecoveryAction(
        summary('uploading'),
      ),
    ).toBe('resume');
  });

  it('formats completed over expected progress', () => {
    expect(
      sessionRecoveryProgress(
        summary('uploading'),
      ),
    ).toBe('4/10');
  });
});