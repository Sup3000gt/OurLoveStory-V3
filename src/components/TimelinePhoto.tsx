import { useState } from 'react';
import type { TimelinePhoto as TimelinePhotoData } from '../../shared/contracts';
import { timelinePreviewClass } from '../lib/timeline';

interface TimelinePhotoProps {
  photo: TimelinePhotoData;
  periodLabel: string;
  loading: 'eager' | 'lazy';
}

export function TimelinePhoto({
  photo,
  periodLabel,
  loading,
}: TimelinePhotoProps) {
  const [previewClass, setPreviewClass] = useState('timeline-preview--landscape');

  return (
    <div className="timeline-preview-frame" data-preview-ratio="3:2">
      <img
        alt={`${photo.memoryTitle} — ${periodLabel}`}
        className={`timeline-preview ${previewClass}`}
        loading={loading}
        onLoad={(event) => setPreviewClass(timelinePreviewClass(event.currentTarget))}
        src={photo.previewUrl}
      />
    </div>
  );
}
