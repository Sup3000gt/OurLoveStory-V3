import {
  describe,
  expect,
  it,
} from 'vitest';
import type {
  UploadSessionSummary,
} from '../../shared/contracts';
import {
  addPhotosPageMode,
} from './AddPhotosPage';

function active():
  UploadSessionSummary {
  return {
    id: 'session-a',
    kind: 'append',
    memoryId: 'memory-a',
    title: null,
    expectedFileCount: 10,
    completedFileCount: 4,
    status: 'uploading',
    updatedAt: '',
    expiresAt: '',
  };
}

describe('addPhotosPageMode', () => {
  it('shows recovery when an Append Session exists', () => {
    expect(
      addPhotosPageMode(
        active(),
      ),
    ).toBe('recover');
  });

  it('shows selection when no Append Session exists', () => {
    expect(
      addPhotosPageMode(
        null,
      ),
    ).toBe('select');
  });
});