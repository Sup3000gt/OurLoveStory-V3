import { describe, expect, it, vi } from 'vitest';
import type { Env, OwnerIdentity } from '../env';
import { sessionThumbnailKey } from './image-derivatives';
import { handleUploadSessionRoute } from './upload-session-routes';
import {
  readUploadSessionThumbnail,
} from './upload-session-service';

const owner: OwnerIdentity = {
  userId: 'owner-1',
  email: 'owner@example.com',
  displayName: 'Owner',
};

const uploadedFile = {
  id: 'file-1',
  upload_session_id: 'session-1',
  original_filename: 'photo.jpg',
  mime_type: 'image/jpeg',
  size_bytes: 123,
  file_status: 'uploaded',
  object_key: 'originals/owner-1/session-1/file-1.jpg',
} as const;

function envFor(file: unknown, derivative?: Uint8Array): Env {
  const original = {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([4]));
        controller.close();
      },
    }),
  };
  const stored = derivative
    ? { body: new ReadableStream({
        start(controller) {
          controller.enqueue(derivative);
          controller.close();
        },
      }), arrayBuffer: async () => derivative.buffer }
    : null;
  const mediaGet = vi.fn(async (key: string) =>
    key === sessionThumbnailKey('session-1', 'file-1')
      ? stored
      : original);
  const prepare = vi.fn(() => ({
    bind: vi.fn(() => ({
      first: vi.fn(async () => file),
    })),
  }));
  return {
    DB: { prepare } as unknown as D1Database,
    MEDIA: {
      get: mediaGet,
      put: vi.fn(async () => undefined),
    } as unknown as R2Bucket,
    IMAGES: {
      input: vi.fn(() => ({
        transform: vi.fn().mockReturnThis(),
        output: vi.fn(async () => ({
          response: async () => new Response(new Uint8Array([1, 2])),
        })),
      })),
    },
  } as unknown as Env;
}

describe('upload Session thumbnails', () => {
  it('serves an owned uploaded file through the Session derivative', async () => {
    const env = envFor(uploadedFile);
    const result = await readUploadSessionThumbnail(
      env,
      owner,
      'session-1',
      'file-1',
    );

    expect(result).toMatchObject({
      key: sessionThumbnailKey('session-1', 'file-1'),
      contentType: 'image/webp',
    });
  });

  it('returns 404 for another Owner file', async () => {
    await expect(
      readUploadSessionThumbnail(
        envFor(null),
        owner,
        'session-1',
        'file-1',
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it.each(['pending', 'failed', 'skipped'])(
    'returns 404 for a %s file',
    async (status) => {
      await expect(
        readUploadSessionThumbnail(
          envFor({ ...uploadedFile, file_status: status }),
          owner,
          'session-1',
          'file-1',
        ),
      ).rejects.toMatchObject({ status: 404 });
    },
  );

  it('returns 404 when the uploaded file has no Original', async () => {
    await expect(
      readUploadSessionThumbnail(
        envFor({ ...uploadedFile, object_key: null }),
        owner,
        'session-1',
        'file-1',
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('does not include a body for HEAD and uses private no-store', async () => {
    const env = envFor(uploadedFile, new Uint8Array([1, 2, 3]));
    const response = await handleUploadSessionRoute(
      new Request(
        'https://example.com/api/upload-sessions/session-1/files/file-1/thumbnail',
        { method: 'HEAD' },
      ),
      env,
      {} as ExecutionContext,
      owner,
      {
        action: 'thumbnail',
        sessionId: 'session-1',
        fileId: 'file-1',
      },
      'request-1',
    );

    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('reads the stored Session derivative on the second request', async () => {
    const derivative = new Uint8Array([9, 8, 7]);
    const get = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([4]));
            controller.close();
          },
        }),
      })
      .mockResolvedValueOnce({
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(derivative);
            controller.close();
          },
        }),
        arrayBuffer: async () => derivative.buffer,
      });
    const env = {
      ...envFor(uploadedFile),
      MEDIA: {
        get,
        put: vi.fn(async () => undefined),
      } as unknown as R2Bucket,
      IMAGES: {
        input: vi.fn(() => ({
          transform: vi.fn().mockReturnThis(),
          output: vi.fn(async () => ({
            response: async () => new Response(new Uint8Array([1, 2])),
          })),
        })),
      },
    } as unknown as Env;

    await readUploadSessionThumbnail(env, owner, 'session-1', 'file-1');
    const second = await readUploadSessionThumbnail(
      env,
      owner,
      'session-1',
      'file-1',
    );

    expect(second.bytes).toEqual(derivative);
    expect(get).toHaveBeenLastCalledWith(
      sessionThumbnailKey('session-1', 'file-1'),
    );
  });
});
