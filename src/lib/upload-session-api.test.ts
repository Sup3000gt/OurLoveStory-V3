import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  createUploadSession,
  listUploadSessions,
} from './api';

const getToken = async () => 'owner-token';

describe('Upload Session API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends an Owner token when creating a Session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'session-a',
          files: [],
        }),
        {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    await createUploadSession(
      {
        sessionKind: 'append',
        memoryId: 'memory-a',
        files: [
          {
            resumeFingerprint: 'a'.repeat(64),
            contentHash: 'b'.repeat(64),
            occurrenceIndex: 0,
            filename: 'photo.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: 4,
            originalSortOrder: 0,
            targetVisibility: 'private',
          },
        ],
      },
      getToken,
    );

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];

    expect(url).toBe('/api/upload-sessions');
    expect(init.method).toBe('POST');
    expect(
      new Headers(init.headers).get('authorization'),
    ).toBe('Bearer owner-token');
  });

  it('lists active Sessions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            sessions: [
              {
                id: 'session-a',
                kind: 'append',
                memoryId: 'memory-a',
                title: null,
                expectedFileCount: 2,
                completedFileCount: 1,
                status: 'uploading',
                updatedAt: '',
                expiresAt: '',
              },
            ],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      ),
    );

    expect(await listUploadSessions(getToken)).toHaveLength(1);
  });

  it('preserves the HTTP status on API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error:
              'This album already has an unfinished photo addition.',
          }),
          {
            status: 409,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      ),
    );

    await expect(
      listUploadSessions(getToken),
    ).rejects.toMatchObject({
      status: 409,
    });
  });
});