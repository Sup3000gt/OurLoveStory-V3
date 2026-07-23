import type {
  TimelinePhoto,
  TimelineResponse,
} from '../../shared/contracts';

export interface TimelinePeriod {
  periodType: 'year' | 'month';
  periodKey: string;
  label: string;
  photoCount: number;
  cover: TimelinePhoto;
}

export function timelineCoverHref(photo: TimelinePhoto): string {
  return `/memory/${encodeURIComponent(photo.memoryId)}?asset=${encodeURIComponent(photo.assetId)}`;
}

export function timelinePeriods(
  timeline: TimelineResponse,
): TimelinePeriod[] {
  return timeline.years.flatMap((year) => [
    {
      periodType: 'year' as const,
      periodKey: year.key,
      label: year.label,
      photoCount: year.photoCount,
      cover: year.cover,
    },
    ...year.months.map((month) => ({
      periodType: 'month' as const,
      periodKey: month.key,
      label: month.label,
      photoCount: month.photoCount,
      cover: month.cover,
    })),
  ]);
}

export function formatTimelinePhotoCount(photoCount: number): string {
  return `${photoCount} photo${photoCount === 1 ? '' : 's'}`;
}

export function timelinePreviewClass(
  image: Pick<HTMLImageElement, 'naturalWidth' | 'naturalHeight'>,
): 'timeline-preview--portrait' | 'timeline-preview--landscape' {
  return image.naturalHeight > image.naturalWidth
    ? 'timeline-preview--portrait'
    : 'timeline-preview--landscape';
}
