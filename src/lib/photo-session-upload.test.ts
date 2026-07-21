import { describe, expect, it } from 'vitest';
import type {
  SessionAuthorizedUpload,
  UploadSessionFileStatus,
} from '../../shared/contracts';
import {
  uploadPendingSessionPhotos,
  type SessionUploadPhoto,
} from './photo-session-upload';

function candidate(
  index: number,
  status: UploadSessionFileStatus = 'pending',
): SessionUploadPhoto {
  return {
    localId: `local-${index}`,
    sessionFileId: `server-${index}`,
    file: new File([`file-${index}`], `${index}.jpg`, {
      type: 'image/jpeg',
    }),
    status,
  };
}

describe('uploadPendingSessionPhotos', () => {
  it('authorizes in batches of twenty and records each upload', async () => {
    const photos = Array.from(
      { length: 25 },
      (_, index) => candidate(index),
    );
    const authorizationBatches: string[][] = [];
    const uploaded: string[] = [];
    const recorded: string[] = [];

    const result = await uploadPendingSessionPhotos({
      sessionId: 'session-a',
      photos,
      getToken: async () => 'token',
      dependencies: {
        authorize: async (_sessionId, fileIds) => {
          authorizationBatches.push([...fileIds]);

          return fileIds.map(
            (sessionFileId): SessionAuthorizedUpload => ({
              sessionFileId,
              objectKey: `objects/${sessionFileId}`,
              uploadUrl: `https://upload/${sessionFileId}`,
              headers: {
                'Content-Type': 'image/jpeg',
              },
              expiresAt: '2026-07-21T01:00:00.000Z',
              mediaType: 'image',
              originalFilename: `${sessionFileId}.jpg`,
              sizeBytes: 10,
            }),
          );
        },
        upload: async (upload) => {
          uploaded.push(upload.sessionFileId);
        },
        recordUploaded: async (
          _sessionId,
          request,
        ) => {
          recorded.push(request.sessionFileId);
        },
        recordFailed: async () => {
          throw new Error('No failure expected.');
        },
      },
    });

    expect(
      authorizationBatches.map((batch) => batch.length),
    ).toEqual([20, 5]);
    expect(uploaded).toHaveLength(25);
    expect(recorded).toHaveLength(25);
    expect(result.completedLocalIds).toHaveLength(25);
  });

  it('skips photos already uploaded or duplicate-skipped', async () => {
    const authorizationBatches: string[][] = [];

    const result = await uploadPendingSessionPhotos({
      sessionId: 'session-a',
      photos: [
        candidate(0, 'uploaded'),
        candidate(1, 'skipped'),
        candidate(2, 'pending'),
      ],
      getToken: async () => 'token',
      dependencies: {
        authorize: async (_sessionId, fileIds) => {
          authorizationBatches.push([...fileIds]);

          return fileIds.map(
            (sessionFileId): SessionAuthorizedUpload => ({
              sessionFileId,
              objectKey: `objects/${sessionFileId}`,
              uploadUrl: `https://upload/${sessionFileId}`,
              headers: {},
              expiresAt: '',
              mediaType: 'image',
              originalFilename: `${sessionFileId}.jpg`,
              sizeBytes: 1,
            }),
          );
        },
        upload: async () => undefined,
        recordUploaded: async () => undefined,
        recordFailed: async () => undefined,
      },
    });

    expect(authorizationBatches).toEqual([
      ['server-2'],
    ]);
    expect(result.completedLocalIds).toEqual([
      'local-0',
      'local-2',
    ]);
  });
});