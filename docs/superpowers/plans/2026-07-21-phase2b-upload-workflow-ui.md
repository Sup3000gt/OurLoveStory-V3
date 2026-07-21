# Phase 2B Upload Workflow UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the Phase 2A photo Upload Session foundation to Owner Studio, existing Memory Add Photos, review, confirmation, abandon, and refresh-safe resume workflows.

**Architecture:** Keep the existing legacy direct-upload path for every selection containing video. Pure-photo workflows use one route-stable in-memory `PhotoSessionUploadProvider`, server-backed Upload Sessions, a dedicated Review route, and complete-batch original-file reselection after browser refresh. Review state is represented by a pure reducer-style model so ordering, visibility, duplicate override, cover validity, and confirmation eligibility are testable without browser rendering.

**Tech Stack:** React 19, TypeScript 5.7, React Router 7, TanStack Query 5, Clerk React 6, Vitest 3, jsdom 25, Vite 6, Cloudflare Workers/D1/R2.

## Global Constraints

- Work only in `D:\Downloads\OurLoveStory-V3-phase2-photo-upload-ui`.
- Work only on branch `feature/photo-upload-review-ui`.
- The implementation-plan base commit is `6583068`.
- Do not edit `main`.
- Do not push, merge, deploy, migrate D1, or modify production R2 during implementation.
- A pure-photo selection contains 1–100 files and uses Upload Sessions.
- Any supported selection containing video uses the existing legacy uploader and remains limited to 20 files.
- Supported Session photo MIME types remain JPEG, PNG, WebP, and GIF.
- Each image remains limited to 50 MiB.
- Each finalized Memory remains limited to 1,000 Assets.
- Every selected photo defaults to Private.
- Exact duplicates are skipped by default; Owner may explicitly choose `Still add`.
- Only the new Append batch may be reordered.
- Existing Memory Assets must not change before Append confirmation.
- Pending Session files must not appear in Memory or Guest queries.
- Route navigation must preserve local `File` objects and object URLs.
- Browser refresh does not preserve photo blobs; resume requires reselecting the complete original batch.
- Uploaded and skipped Session files must never be PUT again during resume.
- Do not persist photo blobs in `localStorage` or IndexedDB.
- Do not add authenticated Session image delivery or HEIC conversion in Phase 2B.
- Do not add a drag-and-drop package; use native drag events plus keyboard/mobile Move Up and Move Down buttons.
- Do not add a testing-library dependency; use pure model tests and existing React/Vitest primitives.
- No user-facing Phase 2B text may be hard-coded in page components.
- Each task follows RED → GREEN → REFACTOR and ends with a commit.
- Run `git diff --check` before every commit.

---

## File Structure

### New production files

- `src/contexts/PhotoSessionUploadContext.tsx`  
  Route-stable Provider and guarded context hook.

- `src/hooks/useUploadSession.ts`  
  Query one server Upload Session by ID.

- `src/lib/upload-session-review.ts`  
  Pure review draft model, reorder operations, duplicate override, cover rules, request building, and confirmation blockers.

- `src/components/upload/ActiveUploadSessions.tsx`  
  Reusable active Create/Append Session recovery cards.

- `src/components/upload/PhotoSelectionPanel.tsx`  
  Reusable pure-photo file picker and `PhotoPreviewGrid` composition.

- `src/components/upload/SessionProgressBanner.tsx`  
  Upload/reselection/retry status presentation.

- `src/components/upload/SessionFilePlaceholder.tsx`  
  Refresh-safe metadata placeholder when no local object URL exists.

- `src/components/upload/UploadSessionReviewCard.tsx`  
  One Session file review card.

- `src/components/upload/UploadSessionReviewGrid.tsx`  
  Native pointer drag, Move Up/Down controls, and review ordering.

- `src/components/upload/ReviewActions.tsx`  
  Save, confirm, and abandon controls.

- `src/pages/AddPhotosPage.tsx`  
  Existing Memory Append workflow.

- `src/pages/UploadSessionReviewPage.tsx`  
  Server Session review, reselect, retry, save, confirm, and abandon workflow.

### New test files

- `src/lib/upload-session-review.test.ts`
- `src/contexts/PhotoSessionUploadContext.test.tsx`
- `src/hooks/useUploadSession.test.ts`
- `src/components/upload/ActiveUploadSessions.test.tsx`
- `src/components/upload/UploadSessionReviewGrid.test.tsx`
- `src/pages/AddPhotosPage.test.tsx`
- `src/pages/UploadSessionReviewPage.test.tsx`
- `src/pages/StudioPage.photo-session.test.tsx`

### Existing files modified

- `src/App.tsx`
- `src/pages/StudioPage.tsx`
- `src/pages/MemoryDetailPage.tsx`
- `src/hooks/usePhotoSessionUpload.ts`
- `src/hooks/useUploadSessions.ts`
- `src/components/upload/PhotoPreviewGrid.tsx`
- `src/i18n/translations.ts`
- `src/styles/feature-upgrades.css`

---

### Task 1: Build the Pure Review State Model

**Files:**
- Create: `src/lib/upload-session-review.ts`
- Create: `src/lib/upload-session-review.test.ts`

**Interfaces:**
- Consumes:
  - `UploadSession`
  - `UploadSessionFile`
  - `UpdateSessionReviewRequest`
  - `Visibility`
- Produces:
  - `ReviewDraft`
  - `ReviewDraftFile`
  - `createReviewDraft(session)`
  - `moveReviewFile(draft, fileId, direction)`
  - `setReviewVisibility(draft, fileId, visibility)`
  - `setReviewSkipped(draft, fileId, skipped)`
  - `keepReviewDuplicate(draft, fileId)`
  - `setReviewCover(draft, fileId)`
  - `buildReviewRequest(draft)`
  - `getReviewBlockingReason(session, draft)`

- [ ] **Step 1: Write the failing review-model tests**

Create `src/lib/upload-session-review.test.ts`:

```ts
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
    resumeFingerprint: id.padEnd(64, '0').slice(0, 64),
    contentHash: id.padEnd(64, '1').slice(0, 64),
    occurrenceIndex: 0,
    filename: `${id}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 10,
    originalSortOrder: 0,
    reviewSortOrder: 0,
    targetVisibility: 'private',
    allowDuplicate: false,
    objectKey: status === 'uploaded' ? `originals/${id}` : null,
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
    memoryId: kind === 'append' ? 'memory-a' : null,
    title: kind === 'create' ? 'Trip' : null,
    location: kind === 'create' ? 'Paris' : null,
    date: kind === 'create' ? '2026-07-21' : null,
    category: kind === 'create' ? 'Travel' : null,
    description: '',
    featured: false,
    targetMemoryStatus: 'published',
    expectedFileCount: files.length,
    completedFileCount: files.length,
    reservedSortStart: kind === 'append' ? 10 : 0,
    proposedCoverSessionFileId: null,
    status: 'review',
    expiresAt: '2026-07-28T00:00:00.000Z',
    createdAt: '2026-07-21T00:00:00.000Z',
    updatedAt: '2026-07-21T00:00:00.000Z',
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

    expect(draft.files.map((item) => item.id)).toEqual([
      'included',
      'skipped',
    ]);
  });

  it('moves only within the included batch', () => {
    const original = createReviewDraft(
      session('append', [
        file('one', 'uploaded', { reviewSortOrder: 0 }),
        file('two', 'uploaded', { reviewSortOrder: 1 }),
        file('skip', 'skipped', { reviewSortOrder: 2 }),
      ]),
    );

    const moved = moveReviewFile(original, 'two', 'up');

    expect(moved.files.map((item) => item.id)).toEqual([
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

    const next = keepReviewDuplicate(original, 'duplicate');

    expect(next.files[0]).toMatchObject({
      allowDuplicate: true,
      skipped: false,
    });
  });

  it('clears a cover when that photo is skipped', () => {
    const original = setReviewCover(
      createReviewDraft(
        session('create', [file('cover')]),
      ),
      'cover',
    );

    expect(
      setReviewSkipped(original, 'cover', true)
        .proposedCoverSessionFileId,
    ).toBeNull();
  });

  it('updates visibility without mutating the original draft', () => {
    const original = createReviewDraft(
      session('append', [file('one')]),
    );
    const next = setReviewVisibility(
      original,
      'one',
      'public',
    );

    expect(original.files[0]?.targetVisibility).toBe('private');
    expect(next.files[0]?.targetVisibility).toBe('public');
  });

  it('requires a valid cover for Create confirmation', () => {
    const current = session('create', [file('one')]);
    const draft = createReviewDraft(current);

    expect(getReviewBlockingReason(current, draft)).toBe(
      'cover-required',
    );

    expect(
      getReviewBlockingReason(
        current,
        setReviewCover(draft, 'one'),
      ),
    ).toBeNull();
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

  it('builds a complete request containing every Session file', () => {
    const current = session('append', [
      file('one', 'uploaded'),
      file('two', 'skipped', {
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

    expect(buildReviewRequest(draft)).toEqual({
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
```

- [ ] **Step 2: Run the review-model test and verify RED**

Run:

```powershell
npm.cmd run test -- src/lib/upload-session-review.test.ts
```

Expected: FAIL because `src/lib/upload-session-review.ts` does not exist.

- [ ] **Step 3: Implement the complete review model**

Create `src/lib/upload-session-review.ts`:

```ts
import type {
  UpdateSessionReviewRequest,
  UploadSession,
  UploadSessionFile,
  Visibility,
} from '../../shared/contracts';

export interface ReviewDraftFile {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  serverStatus: UploadSessionFile['status'];
  duplicate: boolean;
  targetVisibility: Visibility;
  allowDuplicate: boolean;
  skipped: boolean;
  reviewSortOrder: number;
}

export interface ReviewDraft {
  sessionId: string;
  proposedCoverSessionFileId: string | null;
  files: ReviewDraftFile[];
}

export type ReviewMoveDirection = 'up' | 'down';

export type ReviewBlockingReason =
  | 'no-included-photos'
  | 'upload-incomplete'
  | 'cover-required';

export function createReviewDraft(
  session: UploadSession,
): ReviewDraft {
  const files = session.files
    .map((file): ReviewDraftFile => ({
      id: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      serverStatus: file.status,
      duplicate:
        file.lastError === 'duplicate',
      targetVisibility: file.targetVisibility,
      allowDuplicate: file.allowDuplicate,
      skipped: file.status === 'skipped',
      reviewSortOrder: file.reviewSortOrder,
    }))
    .sort(compareDraftFiles)
    .map((file, reviewSortOrder) => ({
      ...file,
      reviewSortOrder,
    }));

  const proposedCoverSessionFileId =
    session.proposedCoverSessionFileId
    ?? (
      session.kind === 'create'
        ? files.find(
            (file) =>
              !file.skipped
              && file.serverStatus === 'uploaded',
          )?.id
          ?? null
        : null
    );

  return {
    sessionId: session.id,
    proposedCoverSessionFileId,
    files,
  };
}

export function moveReviewFile(
  draft: ReviewDraft,
  fileId: string,
  direction: ReviewMoveDirection,
): ReviewDraft {
  const included = draft.files.filter(
    (file) => !file.skipped,
  );
  const skipped = draft.files.filter(
    (file) => file.skipped,
  );
  const index = included.findIndex(
    (file) => file.id === fileId,
  );

  if (index < 0) return draft;

  const targetIndex =
    direction === 'up'
      ? index - 1
      : index + 1;

  if (
    targetIndex < 0
    || targetIndex >= included.length
  ) {
    return draft;
  }

  const reordered = [...included];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(targetIndex, 0, moved!);

  return normalizeReviewOrder({
    ...draft,
    files: [...reordered, ...skipped],
  });
}

export function setReviewVisibility(
  draft: ReviewDraft,
  fileId: string,
  visibility: Visibility,
): ReviewDraft {
  return updateReviewFile(
    draft,
    fileId,
    (file) => ({
      ...file,
      targetVisibility: visibility,
    }),
  );
}

export function setReviewSkipped(
  draft: ReviewDraft,
  fileId: string,
  skipped: boolean,
): ReviewDraft {
  const next = updateReviewFile(
    draft,
    fileId,
    (file) => ({
      ...file,
      skipped,
    }),
  );

  const proposedCoverSessionFileId =
    skipped
    && next.proposedCoverSessionFileId === fileId
      ? null
      : next.proposedCoverSessionFileId;

  return normalizeReviewOrder({
    ...next,
    proposedCoverSessionFileId,
  });
}

export function keepReviewDuplicate(
  draft: ReviewDraft,
  fileId: string,
): ReviewDraft {
  return normalizeReviewOrder(
    updateReviewFile(
      draft,
      fileId,
      (file) => ({
        ...file,
        allowDuplicate: true,
        skipped: false,
      }),
    ),
  );
}

export function setReviewCover(
  draft: ReviewDraft,
  fileId: string | null,
): ReviewDraft {
  if (fileId === null) {
    return {
      ...draft,
      proposedCoverSessionFileId: null,
    };
  }

  const target = draft.files.find(
    (file) => file.id === fileId,
  );

  if (
    !target
    || target.skipped
    || target.serverStatus !== 'uploaded'
  ) {
    return draft;
  }

  return {
    ...draft,
    proposedCoverSessionFileId: fileId,
  };
}

export function buildReviewRequest(
  draft: ReviewDraft,
): UpdateSessionReviewRequest {
  return {
    proposedCoverSessionFileId:
      draft.proposedCoverSessionFileId,
    files: draft.files.map(
      (file, reviewSortOrder) => ({
        sessionFileId: file.id,
        reviewSortOrder,
        targetVisibility:
          file.targetVisibility,
        allowDuplicate:
          file.allowDuplicate,
        skipped: file.skipped,
      }),
    ),
  };
}

export function getReviewBlockingReason(
  session: UploadSession,
  draft: ReviewDraft,
): ReviewBlockingReason | null {
  const included = draft.files.filter(
    (file) => !file.skipped,
  );

  if (included.length === 0) {
    return 'no-included-photos';
  }

  if (
    included.some(
      (file) =>
        file.serverStatus !== 'uploaded',
    )
  ) {
    return 'upload-incomplete';
  }

  if (session.kind === 'create') {
    const cover = included.find(
      (file) =>
        file.id
        === draft.proposedCoverSessionFileId,
    );

    if (!cover) {
      return 'cover-required';
    }
  }

  return null;
}

function updateReviewFile(
  draft: ReviewDraft,
  fileId: string,
  update: (
    file: ReviewDraftFile,
  ) => ReviewDraftFile,
): ReviewDraft {
  return {
    ...draft,
    files: draft.files.map((file) =>
      file.id === fileId
        ? update(file)
        : file,
    ),
  };
}

function normalizeReviewOrder(
  draft: ReviewDraft,
): ReviewDraft {
  const included = draft.files.filter(
    (file) => !file.skipped,
  );
  const skipped = draft.files.filter(
    (file) => file.skipped,
  );

  return {
    ...draft,
    files: [...included, ...skipped]
      .map((file, reviewSortOrder) => ({
        ...file,
        reviewSortOrder,
      })),
  };
}

function compareDraftFiles(
  left: ReviewDraftFile,
  right: ReviewDraftFile,
): number {
  return (
    Number(left.skipped)
    - Number(right.skipped)
    || left.reviewSortOrder
    - right.reviewSortOrder
    || left.id.localeCompare(right.id)
  );
}
```

- [ ] **Step 4: Run the review-model test and verify GREEN**

Run:

```powershell
npm.cmd run test -- src/lib/upload-session-review.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Run TypeScript verification**

Run:

```powershell
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```powershell
git diff --check
git add src/lib/upload-session-review.ts src/lib/upload-session-review.test.ts
git commit -m "feat: add upload session review model"
```

---

### Task 2: Make the Photo Workflow Route-Stable

**Files:**
- Create: `src/contexts/PhotoSessionUploadContext.tsx`
- Create: `src/contexts/PhotoSessionUploadContext.test.tsx`
- Modify: `src/hooks/usePhotoSessionUpload.ts`

**Interfaces:**
- Consumes:
  - Phase 2A `usePhotoSessionUpload`
  - Phase 2A `SelectedPhoto`
  - `UploadSession`
  - `CreatePhotoSessionMetadata`
- Produces:
  - `PhotoSessionUploadProvider`
  - `usePhotoSessionUploadContext()`
  - `startCreateAndUpload(metadata)`
  - `startAppendAndUpload(memoryId)`
  - `resumeAndUpload(sessionId, files)`
  - `hasLocalSession(sessionId)`
  - `localPhotoBySessionFileId(sessionId)`

- [ ] **Step 1: Add failing orchestration tests to the existing hook test boundary**

Create `src/contexts/PhotoSessionUploadContext.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import {
  buildSessionPhotoLookup,
  hasLocalSession,
} from './PhotoSessionUploadContext';
import type {
  SelectedPhoto,
} from '../hooks/usePhotoSessionUpload';

function selected(
  sessionFileId: string | null,
): SelectedPhoto {
  return {
    localId: crypto.randomUUID(),
    file: new File(['photo'], 'photo.jpg', {
      type: 'image/jpeg',
    }),
    previewUrl: `blob:${sessionFileId}`,
    resumeFingerprint: 'a'.repeat(64),
    contentHash: 'b'.repeat(64),
    occurrenceIndex: 0,
    targetVisibility: 'private',
    sessionFileId,
    status: 'uploaded',
    allowDuplicate: false,
    message: '',
  };
}

describe('Photo Session context helpers', () => {
  it('recognizes only the local active Session', () => {
    expect(
      hasLocalSession(
        { id: 'session-a' },
        'session-a',
      ),
    ).toBe(true);

    expect(
      hasLocalSession(
        { id: 'session-a' },
        'session-b',
      ),
    ).toBe(false);
  });

  it('indexes local previews by Session file ID', () => {
    const lookup = buildSessionPhotoLookup([
      selected('file-a'),
      selected(null),
      selected('file-b'),
    ]);

    expect([...lookup.keys()]).toEqual([
      'file-a',
      'file-b',
    ]);
  });
});
```

- [ ] **Step 2: Run the context test and verify RED**

Run:

```powershell
npm.cmd run test -- src/contexts/PhotoSessionUploadContext.test.tsx
```

Expected: FAIL because the context file does not exist.

- [ ] **Step 3: Refactor `usePhotoSessionUpload` to support atomic create/append/resume-and-upload**

In `src/hooks/usePhotoSessionUpload.ts`:

1. Change `attachSession` to return the bound `SelectedPhoto[]`.
2. Extract the existing body of `uploadPending` into an internal function that accepts explicit `UploadSession` and `SelectedPhoto[]`.
3. Preserve the existing public methods.
4. Add the following public methods:

```ts
async function startCreateAndUpload(
  metadata: CreatePhotoSessionMetadata,
): Promise<UploadSession>;

async function startAppendAndUpload(
  memoryId: string,
): Promise<UploadSession>;

async function resumeAndUpload(
  sessionId: string,
  files: File[],
): Promise<UploadSession>;
```

Use this exact orchestration shape:

```ts
const uploadBoundSession = useCallback(
  async (
    targetSession: UploadSession,
    targetPhotos: SelectedPhoto[],
  ): Promise<UploadSession> => {
    const uploadPhotos =
      toSessionUploadPhotos(targetPhotos);

    await uploadPendingSessionPhotos({
      sessionId: targetSession.id,
      photos: uploadPhotos,
      getToken,
      onEvent: updateLocalUploadEvent,
    });

    const refreshed = await getUploadSession(
      targetSession.id,
      getToken,
    );

    attachSession(targetPhotos, refreshed);
    return refreshed;
  },
  [
    attachSession,
    getToken,
    updateLocalUploadEvent,
  ],
);
```

Use this Create implementation:

```ts
const startCreateAndUpload = useCallback(
  async (
    metadata: CreatePhotoSessionMetadata,
  ) => {
    const created = await startCreate(metadata);
    const bound = bindSelectedPhotos(
      photos,
      created,
    );
    setPhotos(bound);
    setSession(created);
    return uploadBoundSession(created, bound);
  },
  [
    photos,
    startCreate,
    uploadBoundSession,
  ],
);
```

Use the same explicit-session pattern for Append and Resume. Do not call `uploadPending()` immediately after a state setter.

Extract these local pure helpers at the bottom of the hook:

```ts
function bindSelectedPhotos(
  selected: SelectedPhoto[],
  session: UploadSession,
): SelectedPhoto[];

function toSessionUploadPhotos(
  selected: SelectedPhoto[],
): SessionUploadPhoto[];
```

`bindSelectedPhotos` must preserve each existing `previewUrl` by `localId`.

- [ ] **Step 4: Create the context Provider**

Create `src/contexts/PhotoSessionUploadContext.tsx`:

```tsx
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from 'react';
import type {
  UploadSession,
} from '../../shared/contracts';
import {
  usePhotoSessionUpload,
  type SelectedPhoto,
} from '../hooks/usePhotoSessionUpload';

type PhotoSessionUploadValue =
  ReturnType<typeof usePhotoSessionUpload>;

const PhotoSessionUploadContext =
  createContext<PhotoSessionUploadValue | null>(
    null,
  );

export interface PhotoSessionUploadProviderProps {
  children: ReactNode;
}

export function PhotoSessionUploadProvider({
  children,
}: PhotoSessionUploadProviderProps) {
  const workflow = usePhotoSessionUpload();

  const value = useMemo(
    () => workflow,
    [workflow],
  );

  return (
    <PhotoSessionUploadContext.Provider
      value={value}
    >
      {children}
    </PhotoSessionUploadContext.Provider>
  );
}

export function usePhotoSessionUploadContext():
  PhotoSessionUploadValue {
  const value = useContext(
    PhotoSessionUploadContext,
  );

  if (!value) {
    throw new Error(
      'usePhotoSessionUploadContext must be used inside PhotoSessionUploadProvider.',
    );
  }

  return value;
}

export function hasLocalSession(
  session: Pick<UploadSession, 'id'> | null,
  sessionId: string,
): boolean {
  return session?.id === sessionId;
}

export function buildSessionPhotoLookup(
  photos: SelectedPhoto[],
): Map<string, SelectedPhoto> {
  return new Map(
    photos.flatMap((photo) =>
      photo.sessionFileId
        ? [[photo.sessionFileId, photo] as const]
        : [],
    ),
  );
}
```

Do not use `useMemo(() => workflow, [workflow])` if the hook returns a new object on every render and lint/type review shows it adds no value; returning `workflow` directly through Provider is acceptable. Do not introduce a reducer solely for identity optimization.

- [ ] **Step 5: Run Task 2 tests**

Run:

```powershell
npm.cmd run test -- `
  src/contexts/PhotoSessionUploadContext.test.tsx `
  src/lib/photo-session-upload.test.ts `
  src/lib/upload-session-selection.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run complete verification**

Run:

```powershell
npm.cmd run check
npm.cmd run build
```

Expected: all tests and build pass.

- [ ] **Step 7: Commit Task 2**

```powershell
git diff --check
git add src/contexts src/hooks/usePhotoSessionUpload.ts
git commit -m "feat: preserve photo upload workflow across routes"
```

---

### Task 3: Add Server Session Queries, Recovery Cards, Provider, and Routes

**Files:**
- Create: `src/hooks/useUploadSession.ts`
- Create: `src/hooks/useUploadSession.test.ts`
- Create: `src/components/upload/ActiveUploadSessions.tsx`
- Create: `src/components/upload/ActiveUploadSessions.test.tsx`
- Create: `src/pages/AddPhotosPage.tsx`
- Create: `src/pages/UploadSessionReviewPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/hooks/useUploadSessions.ts`

**Interfaces:**
- Consumes:
  - `getUploadSession`
  - `listUploadSessions`
  - `abandonUploadSession`
  - `UploadSessionSummary`
  - `PhotoSessionUploadProvider`
- Produces:
  - `useUploadSession(sessionId, enabled)`
  - `ActiveUploadSessions`
  - real route registrations for Add Photos and Review
  - Owner-guarded route page foundations

- [ ] **Step 1: Write the failing query-key and recovery-label tests**

Create `src/hooks/useUploadSession.test.ts`:

```ts
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
});
```

Create `src/components/upload/ActiveUploadSessions.test.tsx` with a pure view-model test:

```tsx
import { describe, expect, it } from 'vitest';
import type {
  UploadSessionSummary,
} from '../../../shared/contracts';
import {
  sessionRecoveryAction,
  sessionRecoveryProgress,
} from './ActiveUploadSessions';

function summary(
  status: UploadSessionSummary['status'],
): UploadSessionSummary {
  return {
    id: 'session-a',
    kind: 'create',
    memoryId: null,
    title: 'Trip',
    expectedFileCount: 10,
    completedFileCount: 4,
    status,
    updatedAt: '2026-07-21T00:00:00.000Z',
    expiresAt: '2026-07-28T00:00:00.000Z',
  };
}

describe('Active Upload Sessions helpers', () => {
  it('uses Review for a review-ready Session', () => {
    expect(
      sessionRecoveryAction(
        summary('review'),
      ),
    ).toBe('review');
  });

  it('uses Resume for an uploading Session', () => {
    expect(
      sessionRecoveryAction(
        summary('uploading'),
      ),
    ).toBe('resume');
  });

  it('formats completed over expected progress', () => {
    expect(
      sessionRecoveryProgress(
        summary('uploading'),
      ),
    ).toBe('4/10');
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm.cmd run test -- `
  src/hooks/useUploadSession.test.ts `
  src/components/upload/ActiveUploadSessions.test.tsx
```

Expected: FAIL because both production files do not exist.

- [ ] **Step 3: Implement one-Session query hook**

Create `src/hooks/useUploadSession.ts`:

```ts
import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { getUploadSession } from '../lib/api';

export function uploadSessionQueryKey(
  sessionId: string,
) {
  return [
    'upload-session',
    sessionId,
  ] as const;
}

export function useUploadSession(
  sessionId: string | undefined,
  enabled: boolean,
) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: uploadSessionQueryKey(
      sessionId ?? '',
    ),
    queryFn: () =>
      getUploadSession(
        sessionId!,
        getToken,
      ),
    enabled:
      enabled
      && Boolean(sessionId),
    staleTime: 0,
    retry: 1,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}
```

- [ ] **Step 4: Tighten active-session query invalidation semantics**

Modify `src/hooks/useUploadSessions.ts`:

```ts
export const uploadSessionsQueryKey = [
  'upload-sessions',
] as const;
```

Use this constant in `useQuery`. Keep `refetchOnMount: 'always'` and `refetchOnWindowFocus: true`.

- [ ] **Step 5: Implement recovery cards**

Create `src/components/upload/ActiveUploadSessions.tsx`:

```tsx
import {
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type {
  UploadSessionSummary,
} from '../../../shared/contracts';

export interface ActiveUploadSessionsProps {
  sessions: UploadSessionSummary[];
  busySessionId: string | null;
  untitledLabel: string;
  uploadingLabel: string;
  reviewLabel: string;
  resumeLabel: string;
  openReviewLabel: string;
  abandonLabel: string;
  progressLabel(
    progress: string,
  ): string;
  onOpen(
    session: UploadSessionSummary,
  ): void;
  onAbandon(
    session: UploadSessionSummary,
  ): void;
}

export function ActiveUploadSessions({
  sessions,
  busySessionId,
  untitledLabel,
  uploadingLabel,
  reviewLabel,
  resumeLabel,
  openReviewLabel,
  abandonLabel,
  progressLabel,
  onOpen,
  onAbandon,
}: ActiveUploadSessionsProps) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <section
      className="active-upload-sessions"
      aria-label={resumeLabel}
    >
      {sessions.map((session) => {
        const action =
          sessionRecoveryAction(session);
        const progress =
          sessionRecoveryProgress(session);
        const busy =
          busySessionId === session.id;

        return (
          <article
            className="active-upload-session-card"
            key={session.id}
          >
            <div>
              <strong>
                {session.title
                  ?? untitledLabel}
              </strong>
              <span>
                {session.status === 'review'
                  ? reviewLabel
                  : uploadingLabel}
              </span>
              <small>
                {progressLabel(progress)}
              </small>
            </div>

            <div className="active-upload-session-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => onOpen(session)}
              >
                <RotateCcw size={15} />
                {action === 'review'
                  ? openReviewLabel
                  : resumeLabel}
              </button>

              <button
                type="button"
                className="asset-delete-button"
                disabled={busy}
                onClick={() =>
                  onAbandon(session)
                }
              >
                <Trash2 size={15} />
                {abandonLabel}
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function sessionRecoveryAction(
  session: UploadSessionSummary,
): 'resume' | 'review' {
  return session.status === 'review'
    ? 'review'
    : 'resume';
}

export function sessionRecoveryProgress(
  session: UploadSessionSummary,
): string {
  return (
    `${session.completedFileCount}`
    + `/${session.expectedFileCount}`
  );
}
```

- [ ] **Step 6: Create Owner-guarded route page foundations**

Create `src/pages/AddPhotosPage.tsx` with this initial real behavior using only existing translation keys:

```tsx
import { LockKeyhole } from 'lucide-react';
import type {
  Memory,
} from '../../shared/contracts';
import {
  useTranslation,
} from '../i18n/useTranslation';

export interface AddPhotosPageProps {
  memories: Memory[];
  isLoading: boolean;
  isOwner: boolean;
}

export function AddPhotosPage({
  memories,
  isLoading,
  isOwner,
}: AddPhotosPageProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <main className="detail-status">
        <p aria-live="polite">
          {t('detail.loading')}
        </p>
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="login-required">
        <LockKeyhole size={40} />
        <h1>
          {t('studio.ownerOnlyTitle')}
        </h1>
      </main>
    );
  }

  return (
    <main className="add-photos-page">
      <h1>{t('studio.chooseMedia')}</h1>
      <p>
        {t('memory.assetCount', {
          count: memories.length,
        })}
      </p>
    </main>
  );
}
```

Create `src/pages/UploadSessionReviewPage.tsx` with this initial real behavior using only existing translation keys:

```tsx
import { LockKeyhole } from 'lucide-react';
import {
  useTranslation,
} from '../i18n/useTranslation';

export interface UploadSessionReviewPageProps {
  isOwner: boolean;
}

export function UploadSessionReviewPage({
  isOwner,
}: UploadSessionReviewPageProps) {
  const { t } = useTranslation();

  if (!isOwner) {
    return (
      <main className="login-required">
        <LockKeyhole size={40} />
        <h1>
          {t('studio.ownerOnlyTitle')}
        </h1>
      </main>
    );
  }

  return (
    <main className="upload-session-review-page">
      <h1>{t('studio.preview')}</h1>
    </main>
  );
}
```

Task 8 replaces these existing-key labels with the final Phase 2B-specific translation keys.

- [ ] **Step 7: Install Provider and routes in App**

Modify `src/App.tsx`:

```tsx
import {
  PhotoSessionUploadProvider,
} from './contexts/PhotoSessionUploadContext';
import {
  AddPhotosPage,
} from './pages/AddPhotosPage';
import {
  UploadSessionReviewPage,
} from './pages/UploadSessionReviewPage';
```

Wrap `<Routes>`:

```tsx
<PhotoSessionUploadProvider>
  <Routes>
    <Route
      path="/"
      element={
        <HomePage
          memories={memories.data ?? []}
          isLoading={memories.isLoading}
          error={memories.error}
          isOwner={isOwner}
        />
      }
    />
    <Route
      path="/gallery"
      element={
        <GalleryPage
          memories={memories.data ?? []}
          isLoading={memories.isLoading}
          error={memories.error}
          isOwner={isOwner}
        />
      }
    />
    <Route
      path="/memory/:memoryId"
      element={
        <MemoryDetailPage
          memories={memories.data ?? []}
          isLoading={memories.isLoading}
          isOwner={isOwner}
        />
      }
    />
    <Route
      path="/studio"
      element={
        <StudioPage
          isOwner={isOwner}
          ownerCheckLoading={
            ownerSession.isLoading
          }
          ownerCheckError={
            ownerSession.error
          }
        />
      }
    />
    <Route
      path="/memory/:memoryId/add-photos"
      element={
        <AddPhotosPage
          memories={memories.data ?? []}
          isLoading={memories.isLoading}
          isOwner={isOwner}
        />
      }
    />
    <Route
      path="/upload-sessions/:sessionId/review"
      element={
        <UploadSessionReviewPage
          isOwner={isOwner}
        />
      }
    />
  </Routes>
</PhotoSessionUploadProvider>
```

Keep `Header` outside the Provider and inside `BrowserRouter`.

- [ ] **Step 8: Run Task 3 tests and build**

```powershell
npm.cmd run test -- `
  src/hooks/useUploadSession.test.ts `
  src/components/upload/ActiveUploadSessions.test.tsx
npm.cmd run check
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

```powershell
git diff --check
git add src/App.tsx src/hooks src/components/upload/ActiveUploadSessions.tsx src/components/upload/ActiveUploadSessions.test.tsx src/pages/AddPhotosPage.tsx src/pages/UploadSessionReviewPage.tsx
git commit -m "feat: add upload session recovery routes"
```

---

### Task 4: Integrate Pure-Photo Create Sessions into Studio

**Files:**
- Create: `src/components/upload/PhotoSelectionPanel.tsx`
- Create: `src/pages/StudioPage.photo-session.test.tsx`
- Modify: `src/pages/StudioPage.tsx`
- Modify: `src/components/upload/PhotoPreviewGrid.tsx`

**Interfaces:**
- Consumes:
  - `classifySelection`
  - `usePhotoSessionUploadContext`
  - `startCreateAndUpload`
  - `PhotoPreviewGrid`
  - existing legacy `saveMemory`
- Produces:
  - explicit `photo-session | legacy-media | none` Studio mode
  - 100-photo Create workflow
  - unchanged legacy video workflow

- [ ] **Step 1: Write failing pure Studio mode tests**

Create `src/pages/StudioPage.photo-session.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import {
  chooseStudioSelectionMode,
} from './StudioPage';

describe('Studio selection routing', () => {
  it('routes pure photos to Upload Sessions', () => {
    expect(
      chooseStudioSelectionMode([
        new File(['one'], 'one.jpg', {
          type: 'image/jpeg',
        }),
        new File(['two'], 'two.png', {
          type: 'image/png',
        }),
      ]),
    ).toBe('photo-session');
  });

  it('routes a selection containing video to legacy media', () => {
    expect(
      chooseStudioSelectionMode([
        new File(['one'], 'one.jpg', {
          type: 'image/jpeg',
        }),
        new File(['video'], 'clip.mp4', {
          type: 'video/mp4',
        }),
      ]),
    ).toBe('legacy-media');
  });
});
```

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test -- src/pages/StudioPage.photo-session.test.tsx
```

Expected: FAIL because `chooseStudioSelectionMode` is not exported.

- [ ] **Step 3: Implement reusable pure-photo selection panel**

Create `src/components/upload/PhotoSelectionPanel.tsx`:

```tsx
import { CloudUpload } from 'lucide-react';
import type {
  Visibility,
} from '../../../shared/contracts';
import type {
  SelectedPhoto,
} from '../../hooks/usePhotoSessionUpload';
import { PhotoPreviewGrid } from './PhotoPreviewGrid';

export interface PhotoSelectionPanelProps {
  photos: SelectedPhoto[];
  busy: boolean;
  chooseLabel: string;
  browseLabel: string;
  formatsLabel: string;
  labels: Parameters<typeof PhotoPreviewGrid>[0]['labels'];
  onSelect(files: File[]): void;
  onVisibility(
    localId: string,
    visibility: Visibility,
  ): void;
  onKeepDuplicate(localId: string): void;
  onRemove(localId: string): void;
}

export function PhotoSelectionPanel({
  photos,
  busy,
  chooseLabel,
  browseLabel,
  formatsLabel,
  labels,
  onSelect,
  onVisibility,
  onKeepDuplicate,
  onRemove,
}: PhotoSelectionPanelProps) {
  return (
    <>
      <label className="dropzone">
        <CloudUpload size={38} />
        <strong>{chooseLabel}</strong>
        <span>{browseLabel}</span>
        <small>{formatsLabel}</small>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          disabled={busy}
          onChange={(event) => {
            const files = Array.from(
              event.target.files ?? [],
            );
            event.target.value = '';
            if (files.length > 0) {
              onSelect(files);
            }
          }}
        />
      </label>

      <PhotoPreviewGrid
        photos={photos}
        disabled={busy}
        labels={labels}
        onVisibility={onVisibility}
        onKeepDuplicate={onKeepDuplicate}
        onRemove={onRemove}
      />
    </>
  );
}
```

- [ ] **Step 4: Modify Studio selection state**

In `src/pages/StudioPage.tsx`, export:

```ts
export type StudioSelectionMode =
  | 'none'
  | 'photo-session'
  | 'legacy-media';

export function chooseStudioSelectionMode(
  files: File[],
): Exclude<StudioSelectionMode, 'none'> {
  return classifySelection(files).mode;
}
```

Add state:

```ts
const [selectionMode, setSelectionMode] =
  useState<StudioSelectionMode>('none');

const photoWorkflow =
  usePhotoSessionUploadContext();
```

Replace `selectFiles` with:

```ts
async function selectFiles(
  selected: FileList | null,
) {
  if (!selected) return;

  const nextFiles = Array.from(selected);
  setError('');

  try {
    const mode =
      chooseStudioSelectionMode(nextFiles);

    if (mode === 'photo-session') {
      files.forEach((item) =>
        URL.revokeObjectURL(
          item.previewUrl,
        ),
      );
      setFiles([]);
      setCoverId(null);
      await photoWorkflow.selectPhotos(
        nextFiles,
      );
      setSelectionMode(
        'photo-session',
      );
      return;
    }

    photoWorkflow.reset();
    validateSelectedFiles(nextFiles, t);
    const next = createLegacySelectedMedia(
      nextFiles,
    );
    files.forEach((item) =>
      URL.revokeObjectURL(
        item.previewUrl,
      ),
    );
    setFiles(next);
    setCoverId(next[0]?.id ?? null);
    setSelectionMode('legacy-media');
  } catch (selectionError) {
    setError(
      selectionError instanceof Error
        ? selectionError.message
        : t('studio.invalidSelection'),
    );
  }
}
```

Extract the existing mapping into:

```ts
function createLegacySelectedMedia(
  files: File[],
): SelectedMedia[] {
  return files.map((file) => ({
    id: crypto.randomUUID(),
    file,
    previewUrl:
      URL.createObjectURL(file),
    visibility: 'private',
    uploadState: 'idle',
    uploadMessage: '',
  }));
}
```

- [ ] **Step 5: Split save behavior without changing legacy logic**

Rename the existing `saveMemory` body to:

```ts
async function saveLegacyMemory(
  status: MemoryStatus,
): Promise<void>
```

Add:

```ts
async function savePhotoMemory(
  status: MemoryStatus,
): Promise<void> {
  setError('');

  if (
    !draft.title.trim()
    || !draft.location.trim()
    || !draft.date
  ) {
    setError(t('studio.requiredFields'));
    return;
  }

  if (photoWorkflow.photos.length === 0) {
    setError(t('studio.chooseAtLeastOne'));
    return;
  }

  setBusy(true);

  try {
    const finalSession =
      await photoWorkflow.startCreateAndUpload({
        title: draft.title.trim(),
        location: draft.location.trim(),
        date: draft.date,
        category: draft.category,
        description: draft.description,
        featured: draft.featured,
        targetMemoryStatus: status,
      });

    await queryClient.invalidateQueries({
      queryKey: ['upload-sessions'],
    });

    navigate(
      `/upload-sessions/${finalSession.id}/review`,
    );
  } catch (submissionError) {
    setError(
      submissionError instanceof Error
        ? submissionError.message
        : t('studio.saveError'),
    );
  } finally {
    setBusy(false);
  }
}

async function saveMemory(
  status: MemoryStatus,
): Promise<void> {
  if (selectionMode === 'photo-session') {
    await savePhotoMemory(status);
    return;
  }

  await saveLegacyMemory(status);
}
```

Do not reset the photo workflow before navigating to Review.

- [ ] **Step 6: Render photo or legacy selection UI**

Keep one file input accepting both photo and video. After selection:

- `photo-session` renders `PhotoPreviewGrid` from Provider photos.
- `legacy-media` renders the existing legacy preview strip.
- `none` renders the existing empty hint.

Use `photoWorkflow.setVisibility`, `photoWorkflow.keepDuplicate`, and `photoWorkflow.removePhoto`.

The Studio preview panel uses the first non-skipped Provider photo for `photo-session`; the actual cover is selected in Review.

- [ ] **Step 7: Reset both workflows**

Update `resetForm`:

```ts
function resetForm() {
  files.forEach((item) =>
    URL.revokeObjectURL(item.previewUrl),
  );
  setFiles([]);
  setCoverId(null);
  setSelectionMode('none');
  photoWorkflow.reset();
  setDraft(initialDraft);
  setError('');
  setProgress('');
}
```

- [ ] **Step 8: Run Studio and full verification**

```powershell
npm.cmd run test -- `
  src/pages/StudioPage.photo-session.test.tsx `
  src/lib/photo-file.test.ts `
  src/lib/photo-session-upload.test.ts
npm.cmd run check
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 9: Commit Task 4**

```powershell
git diff --check
git add src/pages/StudioPage.tsx src/pages/StudioPage.photo-session.test.tsx src/components/upload/PhotoSelectionPanel.tsx src/components/upload/PhotoPreviewGrid.tsx
git commit -m "feat: connect studio to photo upload sessions"
```

---

### Task 5: Implement Existing Memory Add Photos

**Files:**
- Create: `src/pages/AddPhotosPage.test.tsx`
- Modify: `src/pages/AddPhotosPage.tsx`
- Modify: `src/pages/MemoryDetailPage.tsx`

**Interfaces:**
- Consumes:
  - `activeAppendSessionForMemory`
  - `useUploadSessions`
  - `PhotoSelectionPanel`
  - `startAppendAndUpload`
  - `abandonUploadSession`
- Produces:
  - Owner-only Add Photos entry
  - active Append Session Resume/Abandon
  - new Append selection and upload

- [ ] **Step 1: Write failing Add Photos decision tests**

Create `src/pages/AddPhotosPage.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
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
      addPhotosPageMode(active()),
    ).toBe('recover');
  });

  it('shows selection when no Append Session exists', () => {
    expect(
      addPhotosPageMode(null),
    ).toBe('select');
  });
});
```

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test -- src/pages/AddPhotosPage.test.tsx
```

Expected: FAIL because `addPhotosPageMode` is not exported.

- [ ] **Step 3: Implement Add Photos page**

Replace `src/pages/AddPhotosPage.tsx` with an Owner-guarded page that:

1. reads `memoryId` from `useParams`
2. finds the Memory from props
3. loads active Sessions with `useUploadSessions(isOwner)`
4. derives active Append with `activeAppendSessionForMemory`
5. shows `ActiveUploadSessions` when one exists
6. otherwise shows `PhotoSelectionPanel`
7. calls `photoWorkflow.selectPhotos(files)`
8. calls `photoWorkflow.startAppendAndUpload(memory.id)`
9. invalidates `['upload-sessions']`
10. navigates to `/upload-sessions/:id/review`

Export:

```ts
export function addPhotosPageMode(
  activeSession:
    UploadSessionSummary | null,
): 'recover' | 'select' {
  return activeSession
    ? 'recover'
    : 'select';
}
```

Use this exact conflict behavior:

```ts
catch (error) {
  if (
    error instanceof ApiRequestError
    && error.status === 409
  ) {
    await queryClient.invalidateQueries({
      queryKey: uploadSessionsQueryKey,
    });
  }

  setError(
    error instanceof Error
      ? error.message
      : t('upload.addPhotosFailed'),
  );
}
```

Abandon behavior:

```ts
await abandonUploadSession(
  session.id,
  getToken,
);
photoWorkflow.reset();
await queryClient.invalidateQueries({
  queryKey: uploadSessionsQueryKey,
});
```

Do not reset local workflow after successful create/upload navigation.

- [ ] **Step 4: Add Memory Detail entry and active progress**

In `src/pages/MemoryDetailPage.tsx`:

- import `ImagePlus`
- load `useUploadSessions(isOwner)`
- derive active Append for this Memory
- add an Owner-only action in the heading:

```tsx
<Link
  className="primary-button detail-add-photos"
  to={`/memory/${memory.id}/add-photos`}
>
  <ImagePlus size={16} />
  {activeAppend
    ? t('detail.continueAddingPhotos')
    : t('detail.addPhotos')}
</Link>
```

When active, show:

```tsx
<small className="detail-active-upload-progress">
  {t('upload.progressCount', {
    completed:
      activeAppend.completedFileCount,
    total:
      activeAppend.expectedFileCount,
  })}
</small>
```

- [ ] **Step 5: Run Add Photos and full verification**

```powershell
npm.cmd run test -- `
  src/pages/AddPhotosPage.test.tsx `
  src/hooks/useUploadSessions.test.ts
npm.cmd run check
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```powershell
git diff --check
git add src/pages/AddPhotosPage.tsx src/pages/AddPhotosPage.test.tsx src/pages/MemoryDetailPage.tsx
git commit -m "feat: add append photos workflow"
```

---

### Task 6: Build Review Presentation Components

**Files:**
- Create: `src/components/upload/SessionProgressBanner.tsx`
- Create: `src/components/upload/SessionFilePlaceholder.tsx`
- Create: `src/components/upload/UploadSessionReviewCard.tsx`
- Create: `src/components/upload/UploadSessionReviewGrid.tsx`
- Create: `src/components/upload/UploadSessionReviewGrid.test.tsx`
- Create: `src/components/upload/ReviewActions.tsx`

**Interfaces:**
- Consumes:
  - `ReviewDraft`
  - `ReviewDraftFile`
  - local `SelectedPhoto` lookup
- Produces:
  - accessible review UI callbacks
  - native drag reorder
  - keyboard/mobile reorder
  - refresh placeholders
  - save/confirm/abandon controls

- [ ] **Step 1: Write failing review-grid helper tests**

Create `src/components/upload/UploadSessionReviewGrid.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import {
  canMoveReviewFile,
  dragDirection,
} from './UploadSessionReviewGrid';

describe('Review grid helpers', () => {
  it('prevents moving the first included item up', () => {
    expect(
      canMoveReviewFile(0, 3, 'up'),
    ).toBe(false);
  });

  it('allows moving the first item down', () => {
    expect(
      canMoveReviewFile(0, 3, 'down'),
    ).toBe(true);
  });

  it('maps drag indices to a movement direction', () => {
    expect(dragDirection(2, 0)).toBe('up');
    expect(dragDirection(0, 2)).toBe('down');
    expect(dragDirection(1, 1)).toBeNull();
  });
});
```

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test -- src/components/upload/UploadSessionReviewGrid.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement placeholder and progress components**

Create `SessionFilePlaceholder.tsx`:

```tsx
import { ImageOff } from 'lucide-react';

export interface SessionFilePlaceholderProps {
  filename: string;
  message: string;
}

export function SessionFilePlaceholder({
  filename,
  message,
}: SessionFilePlaceholderProps) {
  return (
    <div
      className="session-file-placeholder"
      aria-label={`${filename}: ${message}`}
    >
      <ImageOff size={26} />
      <strong>{filename}</strong>
      <span>{message}</span>
    </div>
  );
}
```

Create `SessionProgressBanner.tsx`:

```tsx
export interface SessionProgressBannerProps {
  completed: number;
  total: number;
  message: string;
  error: string;
}

export function SessionProgressBanner({
  completed,
  total,
  message,
  error,
}: SessionProgressBannerProps) {
  return (
    <div className="session-progress-stack">
      <div
        className="session-progress-banner"
        aria-live="polite"
      >
        <strong>{completed}/{total}</strong>
        <span>{message}</span>
      </div>

      {error ? (
        <p
          className="form-message error"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Implement one review card**

Create `UploadSessionReviewCard.tsx` with props:

```ts
export interface UploadSessionReviewCardProps {
  file: ReviewDraftFile;
  previewUrl: string | null;
  isCover: boolean;
  position: number;
  includedCount: number;
  busy: boolean;
  labels: {
    missingPreview: string;
    public: string;
    private: string;
    duplicateSkipped: string;
    stillAdd: string;
    remove: string;
    include: string;
    setCover: string;
    cover: string;
    moveUp: string;
    moveDown: string;
  };
  onVisibility(visibility: Visibility): void;
  onKeepDuplicate(): void;
  onSkipped(skipped: boolean): void;
  onCover(): void;
  onMove(direction: ReviewMoveDirection): void;
  onDragStart(): void;
  onDrop(): void;
}
```

Requirements:

- use `<img>` only when `previewUrl !== null`
- use `SessionFilePlaceholder` otherwise
- `draggable={!busy && !file.skipped}`
- show duplicate warning when `file.duplicate && file.skipped && !file.allowDuplicate`
- show `Still add`
- show Public/Private toggle with `aria-pressed`
- show Remove or Include
- show cover only for included uploaded photos
- show Move Up and Move Down for included photos
- use `canMoveReviewFile` to disable boundary buttons

- [ ] **Step 5: Implement review grid**

Create `UploadSessionReviewGrid.tsx`.

Export:

```ts
export function canMoveReviewFile(
  index: number,
  count: number,
  direction: ReviewMoveDirection,
): boolean;

export function dragDirection(
  fromIndex: number,
  toIndex: number,
): ReviewMoveDirection | null;
```

Track the dragged included file ID in component state. On drop, repeatedly call `onMove(fileId, direction)` until the dragged file reaches the target included index. Do not reorder skipped cards by drag.

Render cards in `draft.files` order. Compute included position from `draft.files.filter(file => !file.skipped)`.

- [ ] **Step 6: Implement review actions**

Create `ReviewActions.tsx`:

```tsx
import {
  Check,
  Save,
  Trash2,
} from 'lucide-react';

export interface ReviewActionsProps {
  busy: boolean;
  confirmDisabled: boolean;
  saveLabel: string;
  confirmLabel: string;
  abandonLabel: string;
  onSave(): void;
  onConfirm(): void;
  onAbandon(): void;
}

export function ReviewActions({
  busy,
  confirmDisabled,
  saveLabel,
  confirmLabel,
  abandonLabel,
  onSave,
  onConfirm,
  onAbandon,
}: ReviewActionsProps) {
  return (
    <div className="review-actions">
      <button
        type="button"
        className="asset-delete-button"
        disabled={busy}
        onClick={onAbandon}
      >
        <Trash2 size={16} />
        {abandonLabel}
      </button>

      <button
        type="button"
        className="secondary-button"
        disabled={busy}
        onClick={onSave}
      >
        <Save size={16} />
        {saveLabel}
      </button>

      <button
        type="button"
        className="primary-button"
        disabled={
          busy
          || confirmDisabled
        }
        onClick={onConfirm}
      >
        <Check size={16} />
        {confirmLabel}
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Run component and model verification**

```powershell
npm.cmd run test -- `
  src/components/upload/UploadSessionReviewGrid.test.tsx `
  src/lib/upload-session-review.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit Task 6**

```powershell
git diff --check
git add src/components/upload src/lib/upload-session-review.ts
git commit -m "feat: add upload session review components"
```

---

### Task 7: Implement Review, Refresh Recovery, Confirm, and Abandon

**Files:**
- Create: `src/pages/UploadSessionReviewPage.test.tsx`
- Modify: `src/pages/UploadSessionReviewPage.tsx`
- Modify: `src/hooks/usePhotoSessionUpload.ts`

**Interfaces:**
- Consumes:
  - `useUploadSession`
  - `usePhotoSessionUploadContext`
  - `buildSessionPhotoLookup`
  - review model and review components
  - `updateUploadSessionReview`
  - `confirmUploadSession`
  - `abandonUploadSession`
- Produces:
  - Review route
  - complete-batch reselection
  - no-repeat resume upload
  - save review
  - confirm Create/Append
  - abandon

- [ ] **Step 1: Write failing Review page decision tests**

Create `src/pages/UploadSessionReviewPage.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import type {
  UploadSession,
} from '../../shared/contracts';
import {
  reviewRecoveryMode,
} from './UploadSessionReviewPage';

function session(
  status: UploadSession['status'],
): UploadSession {
  return {
    id: 'session-a',
    kind: 'append',
    memoryId: 'memory-a',
    title: null,
    location: null,
    date: null,
    category: null,
    description: '',
    featured: false,
    targetMemoryStatus: 'published',
    expectedFileCount: 1,
    completedFileCount:
      status === 'review' ? 1 : 0,
    reservedSortStart: 10,
    proposedCoverSessionFileId: null,
    status,
    expiresAt: '',
    createdAt: '',
    updatedAt: '',
    files: [
      {
        id: 'file-a',
        resumeFingerprint: 'a'.repeat(64),
        contentHash: 'b'.repeat(64),
        occurrenceIndex: 0,
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 10,
        originalSortOrder: 0,
        reviewSortOrder: 0,
        targetVisibility: 'private',
        allowDuplicate: false,
        objectKey:
          status === 'review'
            ? 'originals/photo.jpg'
            : null,
        status:
          status === 'review'
            ? 'uploaded'
            : 'pending',
        lastError: null,
      },
    ],
  };
}

describe('reviewRecoveryMode', () => {
  it('requests original files when upload is incomplete and local files are absent', () => {
    expect(
      reviewRecoveryMode(
        session('uploading'),
        false,
      ),
    ).toBe('reselect');
  });

  it('allows review without local previews when server upload is complete', () => {
    expect(
      reviewRecoveryMode(
        session('review'),
        false,
      ),
    ).toBe('review');
  });

  it('allows retry when local files are still present', () => {
    expect(
      reviewRecoveryMode(
        session('uploading'),
        true,
      ),
    ).toBe('retry');
  });
});
```

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test -- src/pages/UploadSessionReviewPage.test.tsx
```

Expected: FAIL because `reviewRecoveryMode` is not exported.

- [ ] **Step 3: Add a safe Session adoption method to the workflow hook**

Add to `usePhotoSessionUpload`:

```ts
const adoptServerSession = useCallback(
  (nextSession: UploadSession) => {
    setSession(nextSession);

    setPhotos((current) =>
      current.length > 0
      && current.every(
        (photo) =>
          photo.sessionFileId
          && nextSession.files.some(
            (file) =>
              file.id
              === photo.sessionFileId,
          ),
      )
        ? bindSelectedPhotos(
            current,
            nextSession,
          )
        : current,
    );
  },
  [],
);
```

Return `adoptServerSession`.

This method must not invent local previews and must not clear unrelated local files silently. The Review page calls it only when the context Session is already the same ID or the context has no local workflow.

- [ ] **Step 4: Implement Review page state**

Replace `UploadSessionReviewPage.tsx`.

Required state:

```ts
const [draft, setDraft] =
  useState<ReviewDraft | null>(null);
const [busyAction, setBusyAction] =
  useState<
    'save'
    | 'confirm'
    | 'abandon'
    | 'reselect'
    | 'retry'
    | null
  >(null);
const [error, setError] =
  useState('');
```

Required derived values:

```ts
const sessionId = useParams().sessionId;
const sessionQuery =
  useUploadSession(sessionId, isOwner);
const localSession =
  hasLocalSession(
    photoWorkflow.session,
    sessionId ?? '',
  );
const localLookup =
  buildSessionPhotoLookup(
    localSession
      ? photoWorkflow.photos
      : [],
  );
```

Initialize or refresh draft whenever server `updatedAt` changes:

```ts
useEffect(() => {
  if (!sessionQuery.data) return;

  setDraft(
    createReviewDraft(
      sessionQuery.data,
    ),
  );

  if (
    !photoWorkflow.session
    || photoWorkflow.session.id
      === sessionQuery.data.id
  ) {
    photoWorkflow.adoptServerSession(
      sessionQuery.data,
    );
  }
}, [
  sessionQuery.data?.id,
  sessionQuery.data?.updatedAt,
]);
```

Use a targeted eslint-free dependency approach consistent with the existing project; do not disable hooks lint because no lint command exists.

- [ ] **Step 5: Export and implement recovery decision**

```ts
export type ReviewRecoveryMode =
  | 'review'
  | 'retry'
  | 'reselect';

export function reviewRecoveryMode(
  session: UploadSession,
  hasLocalFiles: boolean,
): ReviewRecoveryMode {
  if (session.status === 'review') {
    return 'review';
  }

  return hasLocalFiles
    ? 'retry'
    : 'reselect';
}
```

- [ ] **Step 6: Implement complete-batch reselection**

Render one hidden/visible file input:

```tsx
<input
  type="file"
  multiple
  accept="image/jpeg,image/png,image/webp,image/gif"
  onChange={(event) => {
    const files = Array.from(
      event.target.files ?? [],
    );
    event.target.value = '';

    if (files.length > 0) {
      void reselectAndResume(files);
    }
  }}
/>
```

Implementation:

```ts
async function reselectAndResume(
  files: File[],
) {
  if (!sessionId) return;

  setBusyAction('reselect');
  setError('');

  try {
    const refreshed =
      await photoWorkflow.resumeAndUpload(
        sessionId,
        files,
      );

    queryClient.setQueryData(
      uploadSessionQueryKey(sessionId),
      refreshed,
    );

    setDraft(
      createReviewDraft(refreshed),
    );

    await queryClient.invalidateQueries({
      queryKey:
        uploadSessionsQueryKey,
    });
  } catch (resumeError) {
    setError(
      resumeError instanceof Error
        ? resumeError.message
        : t('upload.reselectFailed'),
    );
  } finally {
    setBusyAction(null);
  }
}
```

The existing `/match` full-batch validation must reject partial selection. Do not weaken it.

- [ ] **Step 7: Implement retry with existing local files**

```ts
async function retryUpload() {
  if (!sessionId) return;

  setBusyAction('retry');
  setError('');

  try {
    const refreshed =
      await photoWorkflow.uploadPending();

    queryClient.setQueryData(
      uploadSessionQueryKey(sessionId),
      refreshed,
    );

    setDraft(
      createReviewDraft(refreshed),
    );

    await queryClient.invalidateQueries({
      queryKey:
        uploadSessionsQueryKey,
    });
  } catch (retryError) {
    setError(
      retryError instanceof Error
        ? retryError.message
        : t('upload.retryFailed'),
    );
  } finally {
    setBusyAction(null);
  }
}
```

Verify `uploadPending` filters server statuses `uploaded` and `skipped`; keep the Phase 2A tests proving this.

- [ ] **Step 8: Implement Save Review**

```ts
async function saveReview():
  Promise<UploadSession | null> {
  if (!sessionId || !draft) {
    return null;
  }

  setBusyAction('save');
  setError('');

  try {
    const refreshed =
      await updateUploadSessionReview(
        sessionId,
        buildReviewRequest(draft),
        getToken,
      );

    queryClient.setQueryData(
      uploadSessionQueryKey(sessionId),
      refreshed,
    );

    photoWorkflow.adoptServerSession(
      refreshed,
    );

    setDraft(
      createReviewDraft(refreshed),
    );

    return refreshed;
  } catch (saveError) {
    setError(
      saveError instanceof Error
        ? saveError.message
        : t('upload.reviewSaveFailed'),
    );
    return null;
  } finally {
    setBusyAction(null);
  }
}
```

- [ ] **Step 9: Implement confirmation**

Do not call `saveReview()` while `busyAction` state is used as a concurrency lock because React state updates are asynchronous. Extract a private `persistReview()` function that performs the API call without changing `busyAction`, then use it from Save and Confirm.

Confirm flow:

```ts
async function confirmReview() {
  if (!sessionId || !draft) return;

  const current = sessionQuery.data;
  if (!current) return;

  const blocker =
    getReviewBlockingReason(
      current,
      draft,
    );

  if (blocker) {
    setError(
      reviewBlockingMessage(blocker, t),
    );
    return;
  }

  setBusyAction('confirm');
  setError('');

  try {
    await persistReview();

    const memory =
      await confirmUploadSession(
        sessionId,
        getToken,
      );

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['memories'],
      }),
      queryClient.invalidateQueries({
        queryKey:
          uploadSessionsQueryKey,
      }),
    ]);

    photoWorkflow.reset();

    navigate(
      `/memory/${memory.id}`,
      { replace: true },
    );
  } catch (confirmError) {
    setError(
      confirmError instanceof Error
        ? confirmError.message
        : t('upload.confirmFailed'),
    );
  } finally {
    setBusyAction(null);
  }
}
```

- [ ] **Step 10: Implement abandon**

Require browser confirmation with translated text.

```ts
async function abandonReview() {
  if (!sessionId) return;
  if (
    !window.confirm(
      t('upload.abandonConfirm'),
    )
  ) {
    return;
  }

  setBusyAction('abandon');
  setError('');

  try {
    await abandonUploadSession(
      sessionId,
      getToken,
    );

    await queryClient.invalidateQueries({
      queryKey:
        uploadSessionsQueryKey,
    });

    photoWorkflow.reset();

    navigate(
      sessionQuery.data?.kind === 'append'
      && sessionQuery.data.memoryId
        ? `/memory/${sessionQuery.data.memoryId}`
        : '/studio',
      { replace: true },
    );
  } catch (abandonError) {
    setError(
      abandonError instanceof Error
        ? abandonError.message
        : t('upload.abandonFailed'),
    );
  } finally {
    setBusyAction(null);
  }
}
```

- [ ] **Step 11: Render the complete Review UI**

Required rendering states:

- non-Owner guard
- loading
- 404/error
- Session `completed`: navigate to Memory when `memoryId` exists
- `uploading` + no local files: reselect banner and file input
- `uploading` + local files: retry button
- `review`: grid and actions
- local preview by `sessionFileId`; placeholder otherwise
- progress banner using server counts
- Public privacy warning when any included draft photo is Public

Wire review callbacks to pure model functions.

- [ ] **Step 12: Run Review and full verification**

```powershell
npm.cmd run test -- `
  src/pages/UploadSessionReviewPage.test.tsx `
  src/lib/upload-session-review.test.ts `
  src/lib/photo-session-upload.test.ts `
  src/lib/upload-session-selection.test.ts
npm.cmd run check
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 13: Commit Task 7**

```powershell
git diff --check
git add src/pages/UploadSessionReviewPage.tsx src/pages/UploadSessionReviewPage.test.tsx src/hooks/usePhotoSessionUpload.ts
git commit -m "feat: add photo session review and recovery"
```

---

### Task 8: Complete Internationalization, Styles, and Accessibility

**Files:**
- Modify: `src/i18n/translations.ts`
- Modify: `src/i18n/translations.test.ts`
- Modify: `src/styles/feature-upgrades.css`
- Modify: `src/pages/AddPhotosPage.tsx`
- Modify: `src/pages/UploadSessionReviewPage.tsx`
- Modify: `src/components/upload/ActiveUploadSessions.tsx`
- Modify: `src/components/upload/PhotoSelectionPanel.tsx`
- Modify: `src/components/upload/UploadSessionReviewCard.tsx`
- Modify: `src/components/upload/ReviewActions.tsx`

**Interfaces:**
- Consumes:
  - existing typed `TranslationKey`
  - `useTranslation`
- Produces:
  - complete English/Chinese Phase 2B copy
  - no hard-coded route-page strings
  - mobile and keyboard-safe styling

- [ ] **Step 1: Add failing translation assertions**

Extend `src/i18n/translations.test.ts`:

```ts
it('translates Phase 2B upload workflow copy', () => {
  expect(
    translate('en', 'upload.addPhotos'),
  ).toBe('Add photos');

  expect(
    translate('zh', 'upload.addPhotos'),
  ).toBe('添加照片');

  expect(
    translate(
      'en',
      'upload.progressCount',
      {
        completed: 4,
        total: 10,
      },
    ),
  ).toBe('4/10 complete');

  expect(
    translate(
      'zh',
      'upload.progressCount',
      {
        completed: 4,
        total: 10,
      },
    ),
  ).toBe('已完成 4/10');
});
```

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test -- src/i18n/translations.test.ts
```

Expected: TypeScript or test failure because keys do not exist.

- [ ] **Step 3: Add exact English keys**

Add to `en`:

```ts
'detail.addPhotos': 'Add photos',
'detail.continueAddingPhotos': 'Continue adding photos',
'upload.activeSessions': 'Unfinished photo uploads',
'upload.untitled': 'Untitled upload',
'upload.uploading': 'Uploading',
'upload.readyToReview': 'Ready to review',
'upload.resume': 'Resume',
'upload.openReview': 'Review',
'upload.abandon': 'Abandon',
'upload.abandonConfirm': 'Abandon this photo upload?\nUploaded temporary files will be removed.',
'upload.abandonFailed': 'The upload could not be abandoned. Please try again.',
'upload.progressCount': '{completed}/{total} complete',
'upload.addPhotos': 'Add photos',
'upload.addPhotosTitle': 'Add photos to this memory',
'upload.addPhotosSubtitle': 'Choose up to 100 photos. New photos will be added after the existing album.',
'upload.addPhotosFailed': 'The photo addition could not be started.',
'upload.choosePhotos': 'Choose photos',
'upload.photoFormats': 'JPEG, PNG, WebP or GIF · up to 100 photos · 50 MiB each',
'upload.selected': 'selected',
'upload.uploaded': 'uploaded',
'upload.duplicate': 'duplicates',
'upload.public': 'Public',
'upload.private': 'Private',
'upload.keepDuplicate': 'Still add',
'upload.remove': 'Remove',
'upload.include': 'Include',
'upload.reviewTitle': 'Review photos',
'upload.reviewCreateSubtitle': 'Choose the final order, visibility, and cover before creating this memory.',
'upload.reviewAppendSubtitle': 'Review only the new photo batch before adding it to this memory.',
'upload.missingPreview': 'Reselect original photos to restore this preview.',
'upload.reselectOriginals': 'Reselect original photos',
'upload.reselectHelp': 'Select the complete original batch. Uploaded photos will not upload again.',
'upload.reselectFailed': 'The selected originals did not match this upload.',
'upload.retryUpload': 'Retry upload',
'upload.retryFailed': 'The remaining photos could not be uploaded.',
'upload.duplicateSkipped': 'Duplicate — skipped',
'upload.setCover': 'Set cover',
'upload.cover': 'Cover',
'upload.moveUp': 'Move up',
'upload.moveDown': 'Move down',
'upload.saveReview': 'Save review',
'upload.reviewSaveFailed': 'The review could not be saved.',
'upload.confirmCreate': 'Create memory',
'upload.confirmAppend': 'Add photos',
'upload.confirmFailed': 'The photo upload could not be confirmed.',
'upload.noIncludedPhotos': 'Include at least one uploaded photo.',
'upload.incompletePhotos': 'Upload every included photo before confirmation.',
'upload.coverRequired': 'Choose an uploaded cover photo.',
'upload.publicWarning': 'Public originals may include camera or GPS metadata.',
'upload.loadingSession': 'Loading this photo upload…',
'upload.sessionUnavailable': 'This photo upload is not available.',
'upload.reviewStatusPending': 'Pending',
'upload.reviewStatusUploading': 'Uploading',
'upload.reviewStatusUploaded': 'Uploaded',
'upload.reviewStatusFailed': 'Failed',
'upload.reviewStatusSkipped': 'Skipped',
```

- [ ] **Step 4: Add exact Chinese keys**

Add to `zh`:

```ts
'detail.addPhotos': '添加照片',
'detail.continueAddingPhotos': '继续添加照片',
'upload.activeSessions': '还没完成的照片上传',
'upload.untitled': '还没起名字的上传',
'upload.uploading': '正在上传',
'upload.readyToReview': '可以检查了',
'upload.resume': '继续',
'upload.openReview': '检查照片',
'upload.abandon': '放弃上传',
'upload.abandonConfirm': '确定放弃这次照片上传吗？\n已经上传的临时文件会被删除。',
'upload.abandonFailed': '这次上传没有成功放弃，再试一次吧。',
'upload.progressCount': '已完成 {completed}/{total}',
'upload.addPhotos': '添加照片',
'upload.addPhotosTitle': '给这段回忆添加照片',
'upload.addPhotosSubtitle': '每次最多选择 100 张，新照片会接在相册现有照片后面。',
'upload.addPhotosFailed': '没有开始这次照片添加，再试一次吧。',
'upload.choosePhotos': '选择照片',
'upload.photoFormats': '支持 JPEG、PNG、WebP、GIF · 每次最多 100 张 · 每张不超过 50 MiB',
'upload.selected': '已选择',
'upload.uploaded': '已上传',
'upload.duplicate': '重复照片',
'upload.public': '公开展示',
'upload.private': '仅我们可见',
'upload.keepDuplicate': '仍然添加',
'upload.remove': '移除',
'upload.include': '重新加入',
'upload.reviewTitle': '检查照片',
'upload.reviewCreateSubtitle': '保存回忆前，确认照片顺序、可见范围和封面。',
'upload.reviewAppendSubtitle': '只检查这次新添加的照片，原相册顺序不会改变。',
'upload.missingPreview': '重新选择原始照片后可以恢复预览。',
'upload.reselectOriginals': '重新选择原始照片',
'upload.reselectHelp': '请选择这次上传的完整原始批次，已经上传的照片不会重复上传。',
'upload.reselectFailed': '这些原始照片和本次上传记录没有完全匹配。',
'upload.retryUpload': '重试上传',
'upload.retryFailed': '剩余照片还是没有上传成功。',
'upload.duplicateSkipped': '重复照片 · 已跳过',
'upload.setCover': '设为封面',
'upload.cover': '当前封面',
'upload.moveUp': '向前移动',
'upload.moveDown': '向后移动',
'upload.saveReview': '保存检查结果',
'upload.reviewSaveFailed': '检查结果没有保存成功。',
'upload.confirmCreate': '创建这段回忆',
'upload.confirmAppend': '添加这些照片',
'upload.confirmFailed': '这次照片上传没有确认成功。',
'upload.noIncludedPhotos': '至少保留一张已经上传的照片。',
'upload.incompletePhotos': '确认前，请先上传所有要保留的照片。',
'upload.coverRequired': '请选择一张已经上传的照片作为封面。',
'upload.publicWarning': '公开原图可能包含相机或 GPS 信息。',
'upload.loadingSession': '正在打开这次照片上传…',
'upload.sessionUnavailable': '这次照片上传暂时看不到。',
'upload.reviewStatusPending': '等待上传',
'upload.reviewStatusUploading': '上传中',
'upload.reviewStatusUploaded': '已上传',
'upload.reviewStatusFailed': '上传失败',
'upload.reviewStatusSkipped': '已跳过',
```

- [ ] **Step 5: Replace route-foundation labels with final Phase 2B keys**

Use `t(...)` in Add Photos, Review, Active Sessions, Review cards, actions, and progress components. Labels are passed from pages to reusable components; reusable components must not import translation context directly.

- [ ] **Step 6: Add exact styles**

Append organized sections to `src/styles/feature-upgrades.css` for:

- `.active-upload-sessions`
- `.active-upload-session-card`
- `.active-upload-session-actions`
- `.detail-add-photos`
- `.detail-active-upload-progress`
- `.add-photos-page`
- `.add-photos-shell`
- `.session-progress-stack`
- `.session-progress-banner`
- `.upload-session-review-page`
- `.upload-session-review-shell`
- `.upload-session-review-grid`
- `.upload-session-review-card`
- `.session-file-placeholder`
- `.review-card-controls`
- `.review-order-actions`
- `.review-actions`
- `.review-public-warning`

Required layout constraints:

```css
.upload-session-review-grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.upload-session-review-card {
  min-width: 0;
  border-radius: 16px;
  overflow: hidden;
}

.upload-session-review-card:focus-within {
  outline: 3px solid rgba(159, 105, 88, .24);
  outline-offset: 3px;
}

.review-actions {
  position: sticky;
  bottom: 12px;
  z-index: 5;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 250, 246, .96);
  backdrop-filter: blur(12px);
}

@media (max-width: 620px) {
  .upload-session-review-grid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .review-actions {
    position: static;
    flex-direction: column-reverse;
  }

  .review-actions > button {
    width: 100%;
  }
}

@media (max-width: 360px) {
  .upload-session-review-grid {
    grid-template-columns: 1fr;
  }
}
```

All icon-only buttons require at least `40px × 40px` on touch layouts.

- [ ] **Step 7: Run translation, accessibility-oriented model, and build verification**

```powershell
npm.cmd run test -- `
  src/i18n/translations.test.ts `
  src/components/upload/UploadSessionReviewGrid.test.tsx `
  src/pages/UploadSessionReviewPage.test.tsx
npm.cmd run check
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 8: Commit Task 8**

```powershell
git diff --check
git add src/i18n src/styles src/pages src/components/upload
git commit -m "feat: polish photo upload review experience"
```

---

### Task 9: Add Workflow Regression Coverage and Final Local Verification

**Files:**
- Modify: `src/lib/photo-session-upload.test.ts`
- Modify: `src/lib/upload-session-selection.test.ts`
- Modify: `src/pages/StudioPage.photo-session.test.tsx`
- Modify: `src/pages/AddPhotosPage.test.tsx`
- Modify: `src/pages/UploadSessionReviewPage.test.tsx`
- Create: `docs/superpowers/plans/2026-07-21-phase2b-manual-verification.md`

**Interfaces:**
- Consumes all Phase 2B public boundaries.
- Produces release-quality evidence and manual Owner walkthrough instructions.

- [ ] **Step 1: Add no-repeat resume regression**

Extend `src/lib/photo-session-upload.test.ts`:

```ts
it('never authorizes uploaded or skipped files during resume', async () => {
  const requested: string[] = [];

  await uploadPendingSessionPhotos({
    sessionId: 'session-a',
    photos: [
      candidate(0, 'uploaded'),
      candidate(1, 'skipped'),
      candidate(2, 'failed'),
      candidate(3, 'pending'),
    ],
    getToken: async () => 'token',
    dependencies: {
      authorize: async (_sessionId, ids) => {
        requested.push(...ids);
        return ids.map((id) => ({
          sessionFileId: id,
          objectKey: `objects/${id}`,
          uploadUrl: `https://upload/${id}`,
          headers: {},
          expiresAt: '',
          mediaType: 'image',
          originalFilename: `${id}.jpg`,
          sizeBytes: 1,
        }));
      },
      upload: async () => undefined,
      recordUploaded: async () => undefined,
      recordFailed: async () => undefined,
    },
  });

  expect(requested).toEqual([
    'server-2',
    'server-3',
  ]);
});
```

- [ ] **Step 2: Add complete-batch resume regression**

Extend `src/lib/upload-session-selection.test.ts` with a Session containing two identical fingerprints and occurrence indexes 0 and 1. Assert that providing only occurrence 0 produces one missing Session file ID through the matching helper or through a new pure helper extracted from `resume`. The production helper must return:

```ts
{
  complete: false,
  missingSessionFileIds: ['server-1'],
  unmatchedLocalIds: [],
}
```

Do not change the backend `/match` contract.

- [ ] **Step 3: Add Studio legacy-preservation regression**

Extend `StudioPage.photo-session.test.tsx`:

```ts
it('keeps the existing twenty-file limit for selections containing video', () => {
  const files = [
    new File(['video'], 'clip.mp4', {
      type: 'video/mp4',
    }),
    ...Array.from(
      { length: 20 },
      (_, index) =>
        new File(
          ['photo'],
          `${index}.jpg`,
          { type: 'image/jpeg' },
        ),
    ),
  ];

  expect(() =>
    chooseStudioSelectionMode(files),
  ).toThrow('20');
});
```

- [ ] **Step 4: Add review eligibility regressions**

Extend `UploadSessionReviewPage.test.tsx` or the pure review-model test to cover:

- Create with no cover → disabled
- Append with no proposed cover → allowed
- all files skipped → blocked
- duplicate `Still add` changes from blocked/skipped to pending until upload completes
- skipping selected cover clears cover
- Public visibility survives `buildReviewRequest`
- ordering applies only to Session files

- [ ] **Step 5: Create manual verification document**

Create `docs/superpowers/plans/2026-07-21-phase2b-manual-verification.md`:

```md
# Phase 2B Manual Verification

## Preconditions

- Run from `D:\Downloads\OurLoveStory-V3-phase2-photo-upload-ui`.
- Branch is `feature/photo-upload-review-ui`.
- Owner is signed into the local application.
- Local Worker uses local D1 and R2; do not target production.
- Keep DevTools Network open and filter for `upload-sessions`.

## Scenario 1: Create with pure photos

1. Open `/studio`.
2. Select three JPEG photos.
3. Confirm all three default to Private.
4. Fill title, location, date, and category.
5. Publish.
6. Confirm the browser navigates to `/upload-sessions/<id>/review`.
7. Confirm all three thumbnails remain visible.
8. Move photo 3 before photo 1.
9. Make photo 2 Public.
10. Select photo 3 as cover.
11. Confirm.
12. Confirm navigation to the new Memory.
13. Confirm final order, visibility, and cover.

## Scenario 2: Legacy video preservation

1. Open `/studio`.
2. Select one MP4 and one JPEG.
3. Confirm the legacy preview UI appears.
4. Save the Memory.
5. Confirm no Upload Session review route is used.

## Scenario 3: Append photos

1. Open an existing Memory as Owner.
2. Select Add photos.
3. Select two new JPEG photos.
4. Confirm navigation to Review.
5. Confirm existing Asset order is not displayed as reorderable.
6. Reverse only the two new photos.
7. Confirm.
8. Confirm both appear after all existing Assets.

## Scenario 4: Duplicate

1. Add a photo whose content hash already exists in the target Memory.
2. Confirm it shows Duplicate — skipped.
3. Confirm it is not uploaded.
4. Select Still add.
5. Confirm it becomes pending.
6. Upload/retry.
7. Confirm and verify a second Asset exists.

## Scenario 5: Refresh recovery

1. Start a five-photo upload.
2. Close or refresh after at least two photos are recorded uploaded.
3. Open the Session Review route.
4. Confirm server filenames and statuses remain visible.
5. Confirm missing previews show placeholders.
6. Select Reselect original photos.
7. Select the complete original five-photo batch.
8. Confirm only pending/failed files receive new PUT requests.
9. Confirm already uploaded files receive no PUT request.
10. Finish Review and confirm.

## Scenario 6: Active Append Session

1. Start adding photos to a Memory.
2. Leave before confirmation.
3. Return to the Memory.
4. Confirm Add photos reads Continue adding photos.
5. Confirm progress is visible.
6. Open the active Session.
7. Confirm a second Append Session cannot be started.

## Scenario 7: Abandon

1. Start a Create or Append Session.
2. Select Abandon.
3. Confirm the warning.
4. Confirm the Session disappears from active recovery UI.
5. Confirm no Memory or Asset was created.

## Scenario 8: Mobile and keyboard

1. Test at 320 px viewport.
2. Confirm review cards remain readable.
3. Confirm all action buttons are reachable.
4. Reorder using Move Up and Move Down without dragging.
5. Tab through every card control.
6. Confirm visible focus indicators.
```

- [ ] **Step 6: Run the complete Phase 2B targeted suite**

Run:

```powershell
npm.cmd run test -- `
  src/lib/upload-session-review.test.ts `
  src/contexts/PhotoSessionUploadContext.test.tsx `
  src/hooks/useUploadSession.test.ts `
  src/components/upload/ActiveUploadSessions.test.tsx `
  src/components/upload/UploadSessionReviewGrid.test.tsx `
  src/pages/StudioPage.photo-session.test.tsx `
  src/pages/AddPhotosPage.test.tsx `
  src/pages/UploadSessionReviewPage.test.tsx `
  src/lib/photo-session-upload.test.ts `
  src/lib/upload-session-selection.test.ts `
  src/i18n/translations.test.ts
```

Expected: all targeted tests pass.

- [ ] **Step 7: Run complete repository verification**

```powershell
npm.cmd run check
npm.cmd run build
git diff --check
```

Expected:

- TypeScript passes.
- Every Vitest file passes.
- Production Vite build passes.
- `git diff --check` prints no errors.

- [ ] **Step 8: Review change scope**

```powershell
git status --short
git diff --stat 6583068..HEAD
git log --oneline --decorate -10
```

Confirm:

- no migration file changed
- no Worker backend file changed
- no `wrangler.toml` changed
- no `.env.local` or `.dev.vars` staged
- only Phase 2B frontend, tests, styles, i18n, and docs changed

- [ ] **Step 9: Commit Task 9**

```powershell
git add src docs/superpowers/plans/2026-07-21-phase2b-manual-verification.md
git commit -m "test: harden photo upload workflow UI"
```

- [ ] **Step 10: Verify clean final checkpoint**

```powershell
npm.cmd run check
npm.cmd run build
git diff --check
git status --porcelain=v1
git log -3 --oneline
```

Expected:

- all tests pass
- build passes
- no diff-check errors
- `git status --porcelain=v1` returns no lines
- latest commit is `test: harden photo upload workflow UI`

Stop here. Do not push, merge, deploy, or run production tests until the user reviews the complete Phase 2B branch.

---

## Plan Self-Review

### Spec coverage

- Provider above Routes: Task 2 and Task 3.
- Studio pure-photo versus legacy-video split: Task 4.
- Add Photos workflow: Task 5.
- Active Create and Append recovery: Task 3 and Task 5.
- Dedicated Review route: Task 3 and Task 7.
- Route-navigation preview preservation: Task 2.
- Refresh placeholders and complete-batch reselection: Task 7.
- Never re-upload completed files: Task 7 and Task 9.
- Duplicate default skip and Still add: Task 1, Task 6, Task 7.
- Visibility: Task 1, Task 6, Task 7.
- New-batch ordering only: Task 1, Task 6, Task 9.
- Proposed cover: Task 1, Task 6, Task 7.
- Save, confirm, abandon: Task 7.
- English and Chinese copy: Task 8.
- Mobile and keyboard accessibility: Task 6, Task 8, Task 9.
- Full verification and manual walkthrough: Task 9.
- No HEIC, authenticated image delivery, IndexedDB, or video migration: Global Constraints.

### Placeholder scan

The plan contains no unresolved markers, omitted implementation steps, or vague instructions to add unspecified handling.

### Type consistency

- `ReviewDraft`, `ReviewDraftFile`, and `ReviewMoveDirection` are defined in Task 1 and consumed consistently in Tasks 6–9.
- `startCreateAndUpload`, `startAppendAndUpload`, `resumeAndUpload`, and `adoptServerSession` are defined in Tasks 2 and 7 before page consumption.
- Query keys are defined in Tasks 3 and reused in Tasks 5 and 7.
- Review request fields exactly match `UpdateSessionReviewRequest`.
- Route paths exactly match the approved design.
