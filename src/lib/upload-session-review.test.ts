import { describe, expect, it } from 'vitest';
import type {
  UploadSession,
  UploadSessionFile,
} from '../../shared/contracts';
import {
  buildReviewRequest,
  createReviewDraft,
  getReviewBlockingReason,
  keepReviewDuplicate,
  moveReviewFile,
  setReviewCover,
  setReviewSkipped,
  setReviewVisibility,
} from './upload-session-review';

function file(
  id: string,
  status: UploadSessionFile['status'] = 'uploaded',
  options: Partial<UploadSessionFile> = {},
): UploadSessionFile {
  return {
    id,
    resumeFingerprint:
      id.padEnd(64, '0').slice(0, 64),
    contentHash:
      id.padEnd(64, '1').slice(0, 64),
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

function session(
  kind: UploadSession['kind'],
  files: UploadSessionFile[],
): UploadSession {
  return {
    id: 'session-a',
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
    expectedFileCount: files.length,
    completedFileCount: files.length,
    reservedSortStart:
      kind === 'append'
        ? 10
        : 0,
    proposedCoverSessionFileId: null,
    status: 'review',
    expiresAt:
      '2026-07-28T00:00:00.000Z',
    createdAt:
      '2026-07-21T00:00:00.000Z',
    updatedAt:
      '2026-07-21T00:00:00.000Z',
    files,
  };
}

describe('Upload Session review model', () => {
  it('places included photos before skipped photos', () => {
    const draft = createReviewDraft(
      session('append', [
        file('skipped', 'skipped', {
          reviewSortOrder: 0,
        }),
        file('included', 'uploaded', {
          reviewSortOrder: 1,
        }),
      ]),
    );

    expect(
      draft.files.map((item) => item.id),
    ).toEqual([
      'included',
      'skipped',
    ]);
  });

  it('moves only within the included batch', () => {
    const original = createReviewDraft(
      session('append', [
        file('one', 'uploaded', {
          reviewSortOrder: 0,
        }),
        file('two', 'uploaded', {
          reviewSortOrder: 1,
        }),
        file('skip', 'skipped', {
          reviewSortOrder: 2,
        }),
      ]),
    );

    const moved = moveReviewFile(
      original,
      'two',
      'up',
    );

    expect(
      moved.files.map((item) => item.id),
    ).toEqual([
      'two',
      'one',
      'skip',
    ]);
  });

  it('keeps a duplicate by clearing skipped and setting allowDuplicate', () => {
    const original = createReviewDraft(
      session('append', [
        file('duplicate', 'skipped', {
          lastError: 'duplicate',
        }),
      ]),
    );

    const next = keepReviewDuplicate(
      original,
      'duplicate',
    );

    expect(next.files[0]).toMatchObject({
      allowDuplicate: true,
      skipped: false,
    });
  });

  it('defaults Create cover to the first included uploaded photo', () => {
    const current = session('create', [
      file('first'),
      file('second'),
    ]);

    const draft = createReviewDraft(current);

    expect(
      draft.proposedCoverSessionFileId,
    ).toBe('first');

    expect(
      getReviewBlockingReason(
        current,
        draft,
      ),
    ).toBeNull();
  });

  it('clears a cover when that photo is skipped', () => {
    const original = setReviewCover(
      createReviewDraft(
        session('create', [
          file('cover'),
          file('other'),
        ]),
      ),
      'cover',
    );

    expect(
      setReviewSkipped(
        original,
        'cover',
        true,
      ).proposedCoverSessionFileId,
    ).toBeNull();
  });

  it('updates visibility without mutating the original draft', () => {
    const original = createReviewDraft(
      session('append', [
        file('one'),
      ]),
    );

    const next = setReviewVisibility(
      original,
      'one',
      'public',
    );

    expect(
      original.files[0]
        ?.targetVisibility,
    ).toBe('private');

    expect(
      next.files[0]
        ?.targetVisibility,
    ).toBe('public');
  });

  it('blocks confirmation while an included photo is not uploaded', () => {
    const current = session('append', [
      file('pending', 'pending'),
    ]);

    expect(
      getReviewBlockingReason(
        current,
        createReviewDraft(current),
      ),
    ).toBe('upload-incomplete');
  });

  it('requires an included photo', () => {
    const current = session('append', [
      file('skipped', 'skipped'),
    ]);

    expect(
      getReviewBlockingReason(
        current,
        createReviewDraft(current),
      ),
    ).toBe('no-included-photos');
  });

  it('builds a complete request containing every Session file', () => {
    const current = session('append', [
      file('one', 'uploaded', {
        reviewSortOrder: 0,
      }),
      file('two', 'skipped', {
        reviewSortOrder: 1,
        lastError: 'duplicate',
      }),
    ]);

    const draft = setReviewVisibility(
      keepReviewDuplicate(
        createReviewDraft(current),
        'two',
      ),
      'two',
      'public',
    );

    expect(
      buildReviewRequest(draft),
    ).toEqual({
      proposedCoverSessionFileId: null,
      files: [
        {
          sessionFileId: 'one',
          reviewSortOrder: 0,
          targetVisibility: 'private',
          allowDuplicate: false,
          skipped: false,
        },
        {
          sessionFileId: 'two',
          reviewSortOrder: 1,
          targetVisibility: 'public',
          allowDuplicate: true,
          skipped: false,
        },
      ],
    });
  });
});