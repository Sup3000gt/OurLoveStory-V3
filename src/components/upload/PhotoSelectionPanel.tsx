import {
  CloudUpload,
} from 'lucide-react';
import type {
  Visibility,
} from '../../../shared/contracts';
import type {
  SelectedPhoto,
} from '../../hooks/usePhotoSessionUpload';
import {
  PhotoPreviewGrid,
  type PhotoPreviewGridProps,
} from './PhotoPreviewGrid';

export interface PhotoSelectionPanelProps {
  photos: SelectedPhoto[];
  busy: boolean;
  chooseLabel: string;
  browseLabel: string;
  formatsLabel: string;
  labels:
    PhotoPreviewGridProps['labels'];
  onSelect(files: File[]): void;
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
        <strong>
          {chooseLabel}
        </strong>
        <span>
          {browseLabel}
        </span>
        <small>
          {formatsLabel}
        </small>

        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          disabled={busy}
          onChange={(event) => {
            const files = Array.from(
              event.target.files
              ?? [],
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
        onVisibility={
          onVisibility
        }
        onKeepDuplicate={
          onKeepDuplicate
        }
        onRemove={onRemove}
      />
    </>
  );
}