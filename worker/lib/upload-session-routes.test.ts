import { describe, expect, it } from 'vitest';
import { matchUploadSessionRoute } from './upload-session-routes';

describe('matchUploadSessionRoute', () => {
  it('matches the collection', () => {
    expect(matchUploadSessionRoute('/api/upload-sessions')).toEqual({
      action: 'collection',
    });
  });

  it('matches confirm', () => {
    expect(
      matchUploadSessionRoute('/api/upload-sessions/session-a/confirm'),
    ).toEqual({
      action: 'confirm',
      sessionId: 'session-a',
    });
  });

  it('matches a Session file', () => {
    expect(
      matchUploadSessionRoute(
        '/api/upload-sessions/session-a/files/file-b',
      ),
    ).toEqual({
      action: 'file',
      sessionId: 'session-a',
      fileId: 'file-b',
    });
  });

  it('matches a Session thumbnail', () => {
    expect(
      matchUploadSessionRoute(
        '/api/upload-sessions/s/files/f/thumbnail',
      ),
    ).toEqual({
      action: 'thumbnail',
      sessionId: 's',
      fileId: 'f',
    });
  });

  it('does not match unrelated routes', () => {
    expect(matchUploadSessionRoute('/api/memories')).toBeNull();
  });
});
