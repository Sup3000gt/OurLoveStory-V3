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
  serverStatus:
    UploadSessionFile['status'];
  duplicate: boolean;
  targetVisibility: Visibility;
  allowDuplicate: boolean;
  skipped: boolean;
  reviewSortOrder: number;
}

export interface ReviewDraft {
  sessionId: string;
  proposedCoverSessionFileId:
    string | null;
  files: ReviewDraftFile[];
}

export type ReviewMoveDirection =
  | 'up'
  | 'down';

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
      targetVisibility:
        file.targetVisibility,
      allowDuplicate:
        file.allowDuplicate,
      skipped:
        file.status === 'skipped',
      reviewSortOrder:
        file.reviewSortOrder,
    }))
    .sort(compareDraftFiles)
    .map(
      (
        file,
        reviewSortOrder,
      ) => ({
        ...file,
        reviewSortOrder,
      }),
    );

  const proposedCoverSessionFileId =
    session.proposedCoverSessionFileId
    ?? (
      session.kind === 'create'
        ? files.find(
            (file) =>
              !file.skipped
              && file.serverStatus
                === 'uploaded',
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
  const included =
    draft.files.filter(
      (file) => !file.skipped,
    );

  const skipped =
    draft.files.filter(
      (file) => file.skipped,
    );

  const index =
    included.findIndex(
      (file) => file.id === fileId,
    );

  if (index < 0) {
    return draft;
  }

  const targetIndex =
    direction === 'up'
      ? index - 1
      : index + 1;

  if (
    targetIndex < 0
    || targetIndex
      >= included.length
  ) {
    return draft;
  }

  const reordered = [...included];
  const [moved] =
    reordered.splice(index, 1);

  reordered.splice(
    targetIndex,
    0,
    moved!,
  );

  return normalizeReviewOrder({
    ...draft,
    files: [
      ...reordered,
      ...skipped,
    ],
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
    && next
      .proposedCoverSessionFileId
      === fileId
      ? null
      : next
        .proposedCoverSessionFileId;

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
      proposedCoverSessionFileId:
        null,
    };
  }

  const target =
    draft.files.find(
      (file) =>
        file.id === fileId,
    );

  if (
    !target
    || target.skipped
    || target.serverStatus
      !== 'uploaded'
  ) {
    return draft;
  }

  return {
    ...draft,
    proposedCoverSessionFileId:
      fileId,
  };
}

export function buildReviewRequest(
  draft: ReviewDraft,
): UpdateSessionReviewRequest {
  return {
    proposedCoverSessionFileId:
      draft
        .proposedCoverSessionFileId,
    files: draft.files.map(
      (
        file,
        reviewSortOrder,
      ) => ({
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
  const included =
    draft.files.filter(
      (file) => !file.skipped,
    );

  if (included.length === 0) {
    return 'no-included-photos';
  }

  if (
    included.some(
      (file) =>
        file.serverStatus
        !== 'uploaded',
    )
  ) {
    return 'upload-incomplete';
  }

  if (session.kind === 'create') {
    const cover =
      included.find(
        (file) =>
          file.id
          === draft
            .proposedCoverSessionFileId,
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
    files: draft.files.map(
      (file) =>
        file.id === fileId
          ? update(file)
          : file,
    ),
  };
}

function normalizeReviewOrder(
  draft: ReviewDraft,
): ReviewDraft {
  const included =
    draft.files.filter(
      (file) => !file.skipped,
    );

  const skipped =
    draft.files.filter(
      (file) => file.skipped,
    );

  return {
    ...draft,
    files: [
      ...included,
      ...skipped,
    ].map(
      (
        file,
        reviewSortOrder,
      ) => ({
        ...file,
        reviewSortOrder,
      }),
    ),
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
    || left.id.localeCompare(
      right.id,
    )
  );
}