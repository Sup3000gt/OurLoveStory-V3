import { describe, expect, it } from 'vitest';
import type { UploadSessionSummary } from '../../shared/contracts';
import {
  activeAppendSessionForMemory,
  activeCreateSessions,
} from './useUploadSessions';

function summary(
  overrides: Partial<UploadSessionSummary>,
): UploadSessionSummary {
  return {
    id: 'session',
    kind: 'append',
    memoryId: 'memory-a',
    title: null,
    expectedFileCount: 2,
    completedFileCount: 1,
    status: 'uploading',
    updatedAt: '',
    expiresAt: '',
    ...overrides,
  };
}

describe('Upload Session selectors', () => {
  it('finds the active Append Session for a Memory', () => {
    expect(
      activeAppendSessionForMemory(
        [
          summary({
            id: 'review',
            status: 'review',
          }),
        ],
        'memory-a',
      )?.id,
    ).toBe('review');
  });

  it('returns only active Create Sessions', () => {
    expect(
      activeCreateSessions([
        summary({
          id: 'create-a',
          kind: 'create',
          memoryId: null,
        }),
        summary({
          id: 'append-a',
          kind: 'append',
        }),
      ]).map((session) => session.id),
    ).toEqual(['create-a']);
  });
});