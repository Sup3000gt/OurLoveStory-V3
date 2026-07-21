import {
  useState,
} from 'react';
import type {
  Visibility,
} from '../../../shared/contracts';
import type {
  ReviewDraft,
  ReviewMoveDirection,
} from '../../lib/upload-session-review';
import {
  UploadSessionReviewCard,
  type UploadSessionReviewCardLabels,
} from './UploadSessionReviewCard';

export interface UploadSessionReviewGridProps {
  draft: ReviewDraft;
  previewBySessionFileId:
    ReadonlyMap<
      string,
      string
    >;
  busy: boolean;
  labels:
    UploadSessionReviewCardLabels;
  onVisibility(
    fileId: string,
    visibility: Visibility,
  ): void;
  onKeepDuplicate(
    fileId: string,
  ): void;
  onSkipped(
    fileId: string,
    skipped: boolean,
  ): void;
  onCover(
    fileId: string,
  ): void;
  onMove(
    fileId: string,
    direction:
      ReviewMoveDirection,
  ): void;
}

export function canMoveReviewFile(
  index: number,
  count: number,
  direction:
    ReviewMoveDirection,
): boolean {
  if (
    index < 0
    || count < 1
  ) {
    return false;
  }

  return direction === 'up'
    ? index > 0
    : index < count - 1;
}

export function dragDirection(
  fromIndex: number,
  toIndex: number,
): ReviewMoveDirection | null {
  if (
    fromIndex === toIndex
  ) {
    return null;
  }

  return fromIndex > toIndex
    ? 'up'
    : 'down';
}

export function UploadSessionReviewGrid({
  draft,
  previewBySessionFileId,
  busy,
  labels,
  onVisibility,
  onKeepDuplicate,
  onSkipped,
  onCover,
  onMove,
}: UploadSessionReviewGridProps) {
  const [
    draggedFileId,
    setDraggedFileId,
  ] = useState<
    string | null
  >(null);

  const included =
    draft.files.filter(
      (file) =>
        !file.skipped,
    );

  const includedIndex =
    new Map(
      included.map(
        (
          file,
          index,
        ) => [
          file.id,
          index,
        ],
      ),
    );

  function dropOn(
    targetFileId: string,
  ) {
    if (
      !draggedFileId
      || draggedFileId
        === targetFileId
    ) {
      setDraggedFileId(null);
      return;
    }

    const fromIndex =
      includedIndex.get(
        draggedFileId,
      );

    const toIndex =
      includedIndex.get(
        targetFileId,
      );

    if (
      fromIndex === undefined
      || toIndex === undefined
    ) {
      setDraggedFileId(null);
      return;
    }

    const direction =
      dragDirection(
        fromIndex,
        toIndex,
      );

    if (!direction) {
      setDraggedFileId(null);
      return;
    }

    const steps =
      Math.abs(
        toIndex - fromIndex,
      );

    for (
      let step = 0;
      step < steps;
      step += 1
    ) {
      onMove(
        draggedFileId,
        direction,
      );
    }

    setDraggedFileId(null);
  }

  return (
    <div className="upload-session-review-grid">
      {draft.files.map(
        (file) => {
          const position =
            includedIndex.get(
              file.id,
            )
            ?? -1;

          return (
            <UploadSessionReviewCard
              key={file.id}
              file={file}
              previewUrl={
                previewBySessionFileId
                  .get(file.id)
                ?? null
              }
              isCover={
                draft
                  .proposedCoverSessionFileId
                === file.id
              }
              position={
                position
              }
              includedCount={
                included.length
              }
              busy={busy}
              labels={labels}
              onVisibility={(
                visibility,
              ) =>
                onVisibility(
                  file.id,
                  visibility,
                )
              }
              onKeepDuplicate={() =>
                onKeepDuplicate(
                  file.id,
                )
              }
              onSkipped={(
                skipped,
              ) =>
                onSkipped(
                  file.id,
                  skipped,
                )
              }
              onCover={() =>
                onCover(
                  file.id,
                )
              }
              onMove={(
                direction,
              ) =>
                onMove(
                  file.id,
                  direction,
                )
              }
              onDragStart={() =>
                setDraggedFileId(
                  file.id,
                )
              }
              onDragEnd={() =>
                setDraggedFileId(
                  null,
                )
              }
              onDrop={() =>
                dropOn(
                  file.id,
                )
              }
            />
          );
        },
      )}
    </div>
  );
}