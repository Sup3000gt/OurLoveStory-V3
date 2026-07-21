import {
  Globe2,
  LockKeyhole,
  Trash2,
} from 'lucide-react';
import type {
  Visibility,
} from '../../../shared/contracts';
import type {
  SelectedPhoto,
} from '../../hooks/usePhotoSessionUpload';
import { UploadStats } from './UploadStats';

export interface PhotoPreviewGridProps {
  photos: SelectedPhoto[];
  disabled: boolean;
  labels: {
    selected: string;
    uploaded: string;
    duplicate: string;
    public: string;
    private: string;
    keepDuplicate: string;
    remove: string;
  };
  onVisibility(
    localId: string,
    visibility: Visibility,
  ): void;
  onKeepDuplicate(localId: string): void;
  onRemove(localId: string): void;
}

export function PhotoPreviewGrid({
  photos,
  disabled,
  labels,
  onVisibility,
  onKeepDuplicate,
  onRemove,
}: PhotoPreviewGridProps) {
  if (photos.length === 0) return null;

  return (
    <section className="photo-session-selection">
      <UploadStats
        photos={photos}
        labels={labels}
      />

      <div className="upload-preview-strip photo-session-grid">
        {photos.map((photo) => (
          <article
            className={[
              'upload-preview',
              'photo-session-card',
              photo.status,
            ].join(' ')}
            key={photo.localId}
          >
            <div className="upload-preview-media">
              <img
                src={photo.previewUrl}
                alt={photo.file.name}
              />
            </div>

            <div className="photo-session-card-body">
              <strong title={photo.file.name}>
                {photo.file.name}
              </strong>

              <span className="photo-session-status">
                {photo.status}
              </span>

              {photo.status === 'duplicate'
                && !photo.allowDuplicate ? (
                  <button
                    type="button"
                    className="duplicate-override-button"
                    disabled={disabled}
                    onClick={() =>
                      onKeepDuplicate(
                        photo.localId,
                      )
                    }
                  >
                    {labels.keepDuplicate}
                  </button>
                ) : null}

              <button
                type="button"
                className={[
                  'upload-visibility-button',
                  photo.targetVisibility,
                ].join(' ')}
                disabled={disabled}
                onClick={() =>
                  onVisibility(
                    photo.localId,
                    photo.targetVisibility
                      === 'public'
                      ? 'private'
                      : 'public',
                  )
                }
              >
                {photo.targetVisibility
                  === 'public'
                  ? <Globe2 size={13} />
                  : <LockKeyhole size={13} />}
                {photo.targetVisibility
                  === 'public'
                  ? labels.public
                  : labels.private}
              </button>

              <button
                type="button"
                className="photo-session-remove"
                disabled={disabled}
                aria-label={
                  `${labels.remove}: `
                  + photo.file.name
                }
                onClick={() =>
                  onRemove(photo.localId)
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}