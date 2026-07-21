import { describe, expect, it, vi } from 'vitest';
import {
  ReliableUploadBatchError,
  uploadBatchReliably,
} from './reliable-upload';

interface TestUpload {
  key: string;
}

const noDelay = async () => undefined;

describe('uploadBatchReliably', () => {
  it('retries a temporary file failure and keeps successful files to one attempt', async () => {
    const attempts = new Map<string, number>();
    const authorize = vi.fn(async (files: string[]) =>
      files.map((file) => ({ key: `upload-${file}` })),
    );

    const result = await uploadBatchReliably<string, TestUpload>({
      items: [
        { id: 'a', file: 'a.jpg' },
        { id: 'b', file: 'b.jpg' },
      ],
      authorize,
      upload: async (_upload, file) => {
        const attempt = (attempts.get(file) ?? 0) + 1;
        attempts.set(file, attempt);
        if (file === 'a.jpg' && attempt < 3) throw new Error('temporary network failure');
      },
      shouldReauthorize: () => false,
      getFileName: (file) => file,
      concurrency: 2,
      maxRetries: 3,
      sleep: noDelay,
    });

    expect(result.get('a')).toEqual({ key: 'upload-a.jpg' });
    expect(result.get('b')).toEqual({ key: 'upload-b.jpg' });
    expect(attempts.get('a.jpg')).toBe(3);
    expect(attempts.get('b.jpg')).toBe(1);
    expect(authorize).toHaveBeenCalledTimes(1);
  });

  it('refreshes an expired upload authorization before retrying', async () => {
    const authorize = vi
      .fn()
      .mockResolvedValueOnce([{ key: 'expired' }])
      .mockResolvedValueOnce([{ key: 'fresh' }]);
    const usedKeys: string[] = [];

    const result = await uploadBatchReliably<string, TestUpload>({
      items: [{ id: 'a', file: 'a.jpg' }],
      authorize,
      upload: async (upload) => {
        usedKeys.push(upload.key);
        if (upload.key === 'expired') {
          const error = new Error('expired') as Error & { status?: number };
          error.status = 403;
          throw error;
        }
      },
      shouldReauthorize: (error) =>
        typeof error === 'object'
        && error !== null
        && 'status' in error
        && error.status === 403,
      getFileName: (file) => file,
      maxRetries: 3,
      sleep: noDelay,
    });

    expect(usedKeys).toEqual(['expired', 'fresh']);
    expect(authorize).toHaveBeenCalledTimes(2);
    expect(result.get('a')).toEqual({ key: 'fresh' });
  });

  it('never exceeds the requested upload concurrency', async () => {
    let active = 0;
    let maximumActive = 0;

    await uploadBatchReliably<string, TestUpload>({
      items: Array.from({ length: 8 }, (_, index) => ({
        id: String(index),
        file: `${index}.jpg`,
      })),
      authorize: async (files) => files.map((file) => ({ key: file })),
      upload: async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 8));
        active -= 1;
      },
      shouldReauthorize: () => false,
      getFileName: (file) => file,
      concurrency: 3,
      sleep: noDelay,
    });

    expect(maximumActive).toBe(3);
  });

  it('skips files that already completed in an earlier save attempt', async () => {
    const authorize = vi.fn(async (files: string[]) =>
      files.map((file) => ({ key: `new-${file}` })),
    );
    const upload = vi.fn(async () => undefined);

    const result = await uploadBatchReliably<string, TestUpload>({
      items: [
        { id: 'a', file: 'a.jpg', completedUpload: { key: 'existing-a' } },
        { id: 'b', file: 'b.jpg' },
      ],
      authorize,
      upload,
      shouldReauthorize: () => false,
      getFileName: (file) => file,
      sleep: noDelay,
    });

    expect(authorize).toHaveBeenCalledWith(['b.jpg']);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(result.get('a')).toEqual({ key: 'existing-a' });
    expect(result.get('b')).toEqual({ key: 'new-b.jpg' });
  });

  it('waits for the remaining files and reports completed uploads when one file exhausts retries', async () => {
    try {
      await uploadBatchReliably<string, TestUpload>({
        items: [
          { id: 'bad', file: 'bad.jpg' },
          { id: 'good', file: 'good.jpg' },
        ],
        authorize: async (files) => files.map((file) => ({ key: file })),
        upload: async (_upload, file) => {
          if (file === 'bad.jpg') throw new Error('still failing');
        },
        shouldReauthorize: () => false,
        getFileName: (file) => file,
        concurrency: 2,
        maxRetries: 1,
        sleep: noDelay,
      });
      throw new Error('Expected the batch to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ReliableUploadBatchError);
      const batchError = error as ReliableUploadBatchError<TestUpload>;
      expect(batchError.filename).toBe('bad.jpg');
      expect(batchError.completedUploads.get('good')).toEqual({ key: 'good.jpg' });
    }
  });
});