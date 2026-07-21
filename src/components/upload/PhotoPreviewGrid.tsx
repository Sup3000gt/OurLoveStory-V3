import {
  Globe2,
  LockKeyhole,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type {
  Visibility,
} from '../../../shared/contracts';
import type {
  SelectedPhoto,
} from '../../hooks/usePhotoSessionUpload';

export interface PhotoPreviewGridLabels {
  selected: string;
  uploaded: string;
  duplicate: string;
  public: string;
  private: string;
  keepDuplicate: string;
  remove: string;
  statusPending: string;
  statusUploading: string;
  statusUploaded: string;
  statusFailed: string;
  statusSkipped: string;
}

export interface PhotoPreviewGridProps {
  photos: SelectedPhoto[];
  disabled: boolean;
  labels:
    PhotoPreviewGridLabels;
  onVisibility(
    localId: string,
    visibility: Visibility,
  ): void;
  onKeepDuplicate(
    localId: string,
  ): void;
  onRemove(
    localId: string,
  ): void;
}

export function PhotoPreviewGrid({
  photos,
  disabled,
  labels,
  onVisibility,
  onKeepDuplicate,
  onRemove,
}: PhotoPreviewGridProps) {
  if (
    photos.length === 0
  ) {
    return null;
  }

  const uploaded =
    photos.filter(
      (photo) =>
        photo.status
        === 'uploaded',
    ).length;

  const duplicates =
    photos.filter(
      (photo) =>
        photo.status
          === 'duplicate'
        || (
          photo.status
            === 'skipped'
          && !photo
            .allowDuplicate
        ),
    ).length;

  return (
    <section className="photo-preview-section">
      <div className="photo-upload-stats">
        <span>
          <strong>
            {photos.length}
          </strong>
          {labels.selected}
        </span>

        <span>
          <strong>
            {uploaded}
          </strong>
          {labels.uploaded}
        </span>

        <span>
          <strong>
            {duplicates}
          </strong>
          {labels.duplicate}
        </span>
      </div>

      <div className="photo-preview-grid">
        {photos.map((photo) => {
          const duplicate =
            photo.status
              === 'duplicate'
            || (
              photo.status
                === 'skipped'
              && !photo
                .allowDuplicate
            );

          return (
            <article
              className={
                `photo-preview-card ${
                  duplicate
                    ? 'duplicate'
                    : ''
                }`
              }
              key={photo.localId}
            >
              <div className="photo-preview-media">
                <img
                  src={
                    photo.previewUrl
                  }
                  alt={
                    photo.file.name
                  }
                />

                <span
                  className={
                    `selected-upload-state ${
                      photo.status
                    }`
                  }
                >
                  {localPhotoStatusLabel(
                    photo.status,
                    labels,
                  )}
                </span>
              </div>

              <div className="photo-preview-copy">
                <strong
                  title={
                    photo.file.name
                  }
                >
                  {photo.file.name}
                </strong>

                <small>
                  {formatBytes(
                    photo.file.size,
                  )}
                </small>
              </div>

              <div className="photo-preview-actions">
                <button
                  type="button"
                  className={
                    `upload-visibility-button ${
                      photo
                        .targetVisibility
                    }`
                  }
                  aria-pressed={
                    photo
                      .targetVisibility
                    === 'public'
                  }
                  disabled={
                    disabled
                    || duplicate
                  }
                  onClick={() =>
                    onVisibility(
                      photo.localId,
                      photo
                        .targetVisibility
                        === 'public'
                        ? 'private'
                        : 'public',
                    )
                  }
                >
                  {photo
                    .targetVisibility
                    === 'public'
                    ? (
                        <Globe2
                          size={13}
                        />
                      )
                    : (
                        <LockKeyhole
                          size={13}
                        />
                      )}

                  {photo
                    .targetVisibility
                    === 'public'
                    ? labels.public
                    : labels.private}
                </button>

                {duplicate ? (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={disabled}
                    onClick={() =>
                      onKeepDuplicate(
                        photo.localId,
                      )
                    }
                  >
                    <RotateCcw
                      size={14}
                    />
                    {
                      labels
                        .keepDuplicate
                    }
                  </button>
                ) : null}

                <button
                  type="button"
                  className="asset-delete-button"
                  aria-label={
                    `${labels.remove}: ${photo.file.name}`
                  }
                  disabled={disabled}
                  onClick={() =>
                    onRemove(
                      photo.localId,
                    )
                  }
                >
                  <Trash2
                    size={14}
                  />
                  {labels.remove}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function localPhotoStatusLabel(
  status:
    SelectedPhoto['status'],
  labels:
    PhotoPreviewGridLabels,
): string {
  switch (status) {
    case 'uploading':
      return labels
        .statusUploading;

    case 'uploaded':
      return labels
        .statusUploaded;

    case 'failed':
      return labels
        .statusFailed;

    case 'duplicate':
    case 'skipped':
      return labels
        .statusSkipped;

    default:
      return labels
        .statusPending;
  }
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