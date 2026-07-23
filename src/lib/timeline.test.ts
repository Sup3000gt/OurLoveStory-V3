import { describe, expect, it } from 'vitest';
import type { TimelinePhoto, TimelineResponse } from '../../shared/contracts';
import {
  formatTimelinePhotoCount,
  timelineCoverHref,
  timelineMonthArchiveHref,
  timelinePeriods,
  timelinePreviewClass,
  parseTimelineMonthKey,
} from './timeline';

const photo: TimelinePhoto = {
  memoryId: 'memory / one',
  memoryTitle: 'A memory',
  memoryDate: '2026-07-14',
  memoryLocation: 'New York',
  assetId: 'asset & one',
  previewUrl: '/api/assets/asset & one/preview',
  thumbnailUrl: '/api/assets/asset & one/thumbnail',
  filename: 'photo.jpg',
  isExplicitCover: false,
};

describe('timeline presentation helpers', () => {
  it('builds a memory deep link for the exact cover asset', () => {
    expect(timelineCoverHref(photo)).toBe(
      '/memory/memory%20%2F%20one?asset=asset%20%26%20one',
    );
  });

  it('builds a month archive link and rejects invalid month keys', () => {
    expect(timelineMonthArchiveHref('2026-04')).toBe('/timeline/2026-04');
    expect(parseTimelineMonthKey('2026-04')).toEqual({ year: '2026', month: 4 });
    expect(parseTimelineMonthKey('2026-13')).toBeNull();
    expect(parseTimelineMonthKey('April 2026')).toBeNull();
  });

  it('flattens server groups into display periods without mutating the response', () => {
    const timeline: TimelineResponse = {
      years: [{
        key: '2026',
        label: '2026',
        photoCount: 3,
        cover: photo,
        months: [{
          key: '2026-07',
          year: '2026',
          month: 7,
          label: 'July',
          photoCount: 2,
          cover: { ...photo, assetId: 'asset-2' },
        }],
      }],
    };
    const before = structuredClone(timeline);

    expect(timelinePeriods(timeline)).toEqual([
      {
        periodType: 'year',
        periodKey: '2026',
        label: '2026',
        photoCount: 3,
        cover: photo,
      },
      {
        periodType: 'month',
        periodKey: '2026-07',
        label: 'July',
        photoCount: 2,
        cover: { ...photo, assetId: 'asset-2' },
      },
    ]);
    expect(formatTimelinePhotoCount(1)).toBe('1 photo');
    expect(formatTimelinePhotoCount(3)).toBe('3 photos');
    expect(timeline).toEqual(before);
  });

  it('uses a portrait-safe preview class without changing the source URL', () => {
    const previewUrl = photo.previewUrl;
    expect(timelinePreviewClass({ naturalWidth: 800, naturalHeight: 1200 }))
      .toBe('timeline-preview--portrait');
    expect(timelinePreviewClass({ naturalWidth: 1200, naturalHeight: 800 }))
      .toBe('timeline-preview--landscape');
    expect(photo.previewUrl).toBe(previewUrl);
  });
});
