import { describe, expect, it } from 'vitest';
import {
  uploadSessionQueryKey,
} from './useUploadSession';

describe('uploadSessionQueryKey', () => {
  it('includes the Session ID', () => {
    expect(
      uploadSessionQueryKey('session-a'),
    ).toEqual([
      'upload-session',
      'session-a',
    ]);
  });

  it('includes the Clerk user identity for cache writes', () => {
    expect(
      uploadSessionQueryKey('session-a', 'user-a'),
    ).toEqual([
      'upload-session',
      'session-a',
      'user-a',
    ]);
  });
});
