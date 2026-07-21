import {
  describe,
  expect,
  it,
} from 'vitest';
import type {
  UploadSession,
  UploadSessionFile,
} from '../../shared/contracts';
import {
  uploadPendingSessionPhotos,
} from './photo-session-upload';
import {
  hasCompleteUploadSessionMatch,
} from './upload-session-selection';
import {
  buildReviewRequest,
  createReviewDraft,
  getReviewBlockingReason,
  keepReviewDuplicate,
  setReviewVisibility,
} from './upload-session-review';

function sessionFile(
  id: string,
  status:
    UploadSessionFile['status'],
  options:
    Partial<UploadSessionFile>
      = {},
): UploadSessionFile {
  return {
    id,
    resumeFingerprint:
      'a'.repeat(64),
    contentHash:
      'b'.repeat(64),
    occurrenceIndex: 0,
    filename: `${id}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 10,
    originalSortOrder: 0,
    reviewSortOrder: 0,
    targetVisibility: 'private',
    allowDuplicate: false,
    objectKey:
      status === 'uploaded'
        ? `originals/${id}`
        : null,
    status,
    lastError: null,
    ...options,
  };
}

function reviewSession(
  kind:
    UploadSession['kind'],
  files:
    UploadSessionFile[],
): UploadSession {
  return {
    id: 'session-review',
    kind,
    memoryId:
      kind === 'append'
        ? 'memory-a'
        : null,
    title:
      kind === 'create'
        ? 'Trip'
        : null,
    location:
      kind === 'create'
        ? 'Paris'
        : null,
    date:
      kind === 'create'
        ? '2026-07-21'
        : null,
    category:
      kind === 'create'
        ? 'Travel'
        : null,
    description: '',
    featured: false,
    targetMemoryStatus: 'published',
    expectedFileCount:
      files.length,
    completedFileCount:
      files.filter(
        (file) =>
          file.status
            === 'uploaded'
          || file.status
            === 'skipped',
      ).length,
    reservedSortStart:
      kind === 'append'
        ? 10
        : 0,
    proposedCoverSessionFileId:
      null,
    status: 'review',
    expiresAt: '',
    createdAt: '',
    updatedAt: '',
    files,
  };
}

describe('photo Upload Session regressions', () => {
  it('never authorizes uploaded or skipped files during resume', async () => {
    const requested:
      string[] = [];

    const photo = (
      suffix: string,
      status:
        'uploaded'
        | 'skipped'
        | 'failed'
        | 'pending',
    ) => ({
      localId:
        `local-${suffix}`,
      sessionFileId:
        `server-${suffix}`,
      file: new File(
        [suffix],
        `${suffix}.jpg`,
        {
          type: 'image/jpeg',
        },
      ),
      status,
    });

    await uploadPendingSessionPhotos({
      sessionId:
        'session-a',
      photos: [
        photo(
          'uploaded',
          'uploaded',
        ),
        photo(
          'skipped',
          'skipped',
        ),
        photo(
          'failed',
          'failed',
        ),
        photo(
          'pending',
          'pending',
        ),
      ],
      getToken:
        async () => 'token',
      dependencies: {
        authorize:
          async (
            _sessionId:
              string,
            ids: string[],
          ) => {
            requested.push(
              ...ids,
            );

            return ids.map(
              (id) => ({
                sessionFileId:
                  id,
                objectKey:
                  `objects/${id}`,
                uploadUrl:
                  `https://upload/${id}`,
                headers: {},
                expiresAt: '',
                mediaType:
                  'image',
                originalFilename:
                  `${id}.jpg`,
                sizeBytes: 1,
              }),
            );
          },
        upload:
          async () =>
            undefined,
        recordUploaded:
          async () =>
            undefined,
        recordFailed:
          async () =>
            undefined,
      } as never,
    });

    expect(requested).toEqual([
      'server-failed',
      'server-pending',
    ]);
  });

  it('requires every duplicate occurrence to match before resume', () => {
    expect(
      hasCompleteUploadSessionMatch({
        missingSessionFileIds: [
          'server-occurrence-1',
        ],
        unmatchedLocalIds: [],
      }),
    ).toBe(false);

    expect(
      hasCompleteUploadSessionMatch({
        missingSessionFileIds: [],
        unmatchedLocalIds: [
          'local-extra',
        ],
      }),
    ).toBe(false);

    expect(
      hasCompleteUploadSessionMatch({
        missingSessionFileIds: [],
        unmatchedLocalIds: [],
      }),
    ).toBe(true);
  });

  it('allows Append confirmation without proposing a cover', () => {
    const current =
      reviewSession(
        'append',
        [
          sessionFile(
            'one',
            'uploaded',
          ),
        ],
      );

    expect(
      getReviewBlockingReason(
        current,
        createReviewDraft(
          current,
        ),
      ),
    ).toBeNull();
  });

  it('requires a kept duplicate to upload before confirmation', () => {
    const current =
      reviewSession(
        'append',
        [
          sessionFile(
            'duplicate',
            'skipped',
            {
              lastError:
                'duplicate',
            },
          ),
        ],
      );

    const draft =
      keepReviewDuplicate(
        createReviewDraft(
          current,
        ),
        'duplicate',
      );

    expect(
      getReviewBlockingReason(
        current,
        draft,
      ),
    ).toBe(
      'upload-incomplete',
    );
  });

  it('preserves Public visibility in the Review request', () => {
    const current =
      reviewSession(
        'append',
        [
          sessionFile(
            'public-photo',
            'uploaded',
          ),
        ],
      );

    const draft =
      setReviewVisibility(
        createReviewDraft(
          current,
        ),
        'public-photo',
        'public',
      );

    expect(
      buildReviewRequest(
        draft,
      ).files[0]
        ?.targetVisibility,
    ).toBe('public');
  });
});