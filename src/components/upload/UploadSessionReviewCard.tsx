import {
  useState,
} from 'react';
import {
  ChevronDown,
  ChevronUp,
  Globe2,
  GripVertical,
  LockKeyhole,
  RotateCcw,
  Star,
  Trash2,
} from 'lucide-react';
import type {
  DragEvent,
} from 'react';
import type {
  Visibility,
} from '../../../shared/contracts';
import type {
  ReviewDraftFile,
  ReviewMoveDirection,
} from '../../lib/upload-session-review';
import {
  appendRetryNonce,
} from '../../lib/image-assets';
import {
  SessionFilePlaceholder,
} from './SessionFilePlaceholder';

export interface UploadSessionReviewCardLabels {
  missingPreview: string;
  unavailablePreview: string;
  retryPreview: string;
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
}

export interface UploadSessionReviewCardProps {
  file: ReviewDraftFile;
  previewUrl: string | null;
  isCover: boolean;
  position: number;
  includedCount: number;
  busy: boolean;
  labels:
    UploadSessionReviewCardLabels;
  onVisibility(
    visibility: Visibility,
  ): void;
  onKeepDuplicate(): void;
  onSkipped(
    skipped: boolean,
  ): void;
  onCover(): void;
  onMove(
    direction:
      ReviewMoveDirection,
  ): void;
  onDragStart(): void;
  onDragEnd(): void;
  onDrop(): void;
}

export function UploadSessionReviewCard({
  file,
  previewUrl,
  isCover,
  position,
  includedCount,
  busy,
  labels,
  onVisibility,
  onKeepDuplicate,
  onSkipped,
  onCover,
  onMove,
  onDragStart,
  onDragEnd,
  onDrop,
}: UploadSessionReviewCardProps) {
  const included =
    !file.skipped;

  const uploaded =
    file.serverStatus
    === 'uploaded';

  const duplicateSkipped =
    file.duplicate
    && file.skipped
    && !file.allowDuplicate;

  const [failedPreviewUrl, setFailedPreviewUrl] =
    useState<string | null>(null);
  const [retryNonce, setRetryNonce] =
    useState<number | null>(null);

  const previewFailed =
    previewUrl !== null
    && failedPreviewUrl === previewUrl;

  const imageUrl =
    previewFailed
    && retryNonce !== null
      ? appendRetryNonce(
          previewUrl,
          retryNonce,
        )
      : previewUrl;

  function startDrag(
    event:
      DragEvent<HTMLElement>,
  ) {
    event.dataTransfer
      .setData(
        'text/plain',
        file.id,
      );

    event.dataTransfer
      .effectAllowed = 'move';

    onDragStart();
  }

  function drop(
    event:
      DragEvent<HTMLElement>,
  ) {
    event.preventDefault();
    onDrop();
  }

  return (
    <article
      className={
        `upload-session-review-card ${
          file.skipped
            ? 'skipped'
            : ''
        } ${
          isCover
            ? 'cover'
            : ''
        }`
      }
      draggable={
        !busy
        && included
      }
      onDragStart={
        startDrag
      }
      onDragEnd={
        onDragEnd
      }
      onDragOver={(event) => {
        if (included) {
          event.preventDefault();
          event.dataTransfer
            .dropEffect = 'move';
        }
      }}
      onDrop={drop}
    >
      <div className="review-card-media">
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={file.filename}
              onError={() => {
                setFailedPreviewUrl(
                  previewUrl,
                );
                setRetryNonce(Date.now());
              }}
            />
            {previewFailed ? (
              <div
                className="review-preview-error"
                role="status"
              >
                <span>
                  {labels
                    .unavailablePreview}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setRetryNonce(
                      Date.now(),
                    )
                  }
                >
                  {labels.retryPreview}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <SessionFilePlaceholder
            filename={
              file.filename
            }
            message={
              labels
                .missingPreview
            }
          />
        )}

        {included ? (
          <span
            className="review-drag-handle"
            aria-hidden="true"
          >
            <GripVertical
              size={18}
            />
          </span>
        ) : null}

        {isCover ? (
          <span className="review-cover-badge">
            <Star
              size={13}
              fill="currentColor"
            />
            {labels.cover}
          </span>
        ) : null}
      </div>

      <div className="review-card-copy">
        <strong
          title={file.filename}
        >
          {file.filename}
        </strong>
        <small>
          {formatBytes(
            file.sizeBytes,
          )}
        </small>
      </div>

      {duplicateSkipped ? (
        <div className="review-duplicate-warning">
          <span>
            {
              labels
                .duplicateSkipped
            }
          </span>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={
              onKeepDuplicate
            }
          >
            <RotateCcw
              size={14}
            />
            {labels.stillAdd}
          </button>
        </div>
      ) : null}

      <div className="review-card-controls">
        <div
          className="review-visibility-actions"
          role="group"
          aria-label={
            file.filename
          }
        >
          <button
            type="button"
            className={
              `upload-visibility-button ${
                file
                  .targetVisibility
                === 'private'
                ? 'private'
                : ''
              }`
            }
            aria-pressed={
              file
                .targetVisibility
              === 'private'
            }
            disabled={
              busy
              || file.skipped
            }
            onClick={() =>
              onVisibility(
                'private',
              )
            }
          >
            <LockKeyhole
              size={13}
            />
            {labels.private}
          </button>

          <button
            type="button"
            className={
              `upload-visibility-button ${
                file
                  .targetVisibility
                === 'public'
                ? 'public'
                : ''
              }`
            }
            aria-pressed={
              file
                .targetVisibility
              === 'public'
            }
            disabled={
              busy
              || file.skipped
            }
            onClick={() =>
              onVisibility(
                'public',
              )
            }
          >
            <Globe2
              size={13}
            />
            {labels.public}
          </button>
        </div>

        {included
        && uploaded ? (
          <button
            type="button"
            className={
              isCover
                ? 'cover-button cover'
                : 'cover-button'
            }
            disabled={
              busy
              || isCover
            }
            onClick={onCover}
          >
            <Star
              size={13}
              fill={
                isCover
                  ? 'currentColor'
                  : 'none'
              }
            />
            {isCover
              ? labels.cover
              : labels.setCover}
          </button>
        ) : null}

        {!duplicateSkipped ? (
          <button
            type="button"
            className={
              file.skipped
                ? 'secondary-button'
                : 'asset-delete-button'
            }
            disabled={busy}
            onClick={() =>
              onSkipped(
                !file.skipped,
              )
            }
          >
            {file.skipped ? (
              <RotateCcw
                size={14}
              />
            ) : (
              <Trash2
                size={14}
              />
            )}
            {file.skipped
              ? labels.include
              : labels.remove}
          </button>
        ) : null}
      </div>

      {included ? (
        <div className="review-order-actions">
          <button
            type="button"
            className="quiet-button"
            disabled={
              busy
              || !canMove(
                position,
                includedCount,
                'up',
              )
            }
            onClick={() =>
              onMove('up')
            }
          >
            <ChevronUp
              size={15}
            />
            {labels.moveUp}
          </button>

          <button
            type="button"
            className="quiet-button"
            disabled={
              busy
              || !canMove(
                position,
                includedCount,
                'down',
              )
            }
            onClick={() =>
              onMove('down')
            }
          >
            <ChevronDown
              size={15}
            />
            {labels.moveDown}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function canMove(
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

function formatBytes(
  bytes: number,
): string {
  if (
    bytes
    < 1024 * 1024
  ) {
    return (
      `${Math.max(
        1,
        Math.round(
          bytes / 1024,
        ),
      )} KB`
    );
  }

  return (
    `${
      (
        bytes
        / (1024 * 1024)
      ).toFixed(1)
    } MB`
  );
}
