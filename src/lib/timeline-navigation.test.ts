import { describe, expect, it } from 'vitest';
import type { TimelineMonth, TimelineResponse } from '../../shared/contracts';
import {
  adjacentTimelineMonths,
  timelineYearAnchor,
  visibleTimelineMonths,
} from './timeline-navigation';

const month = (key: string, year: string, monthNumber: number, photoCount: number) => ({
  key,
  year,
  month: monthNumber,
  label: key,
  photoCount,
}) as TimelineMonth;

describe('timeline navigation', () => {
  it('creates a stable year anchor', () => {
    expect(timelineYearAnchor(2026)).toBe('year-2026');
  });

  it('flattens visible months in chronological order without mutating the timeline', () => {
    const timeline = {
      years: [{
        key: '2026',
        label: '2026',
        photoCount: 40,
        months: [
          month('2026-05', '2026', 5, 32),
          month('2026-04', '2026', 4, 0),
          month('2026-03', '2026', 3, 8),
        ],
      }],
    } as TimelineResponse;
    const originalMonths = [...timeline.years[0].months];

    expect(visibleTimelineMonths(timeline).map((item) => item.key)).toEqual([
      '2026-03',
      '2026-05',
    ]);
    expect(timeline.years[0].months).toEqual(originalMonths);
  });

  it('skips empty months when finding adjacent archives', () => {
    const months = [
      month('2026-03', '2026', 3, 8),
      month('2026-04', '2026', 4, 0),
      month('2026-05', '2026', 5, 32),
    ];

    expect(adjacentTimelineMonths(months, '2026-03')).toEqual({
      previous: null,
      next: '2026-05',
    });
    expect(adjacentTimelineMonths(months, '2026-05')).toEqual({
      previous: '2026-03',
      next: null,
    });
  });

  it('finds neighboring non-empty archives from an empty current month', () => {
    const months = [
      month('2026-03', '2026', 3, 8),
      month('2026-04', '2026', 4, 0),
      month('2026-05', '2026', 5, 32),
    ];

    expect(adjacentTimelineMonths(months, '2026-04')).toEqual({
      previous: '2026-03',
      next: '2026-05',
    });
  });

  it('finds surrounding non-empty archives when the current month is absent', () => {
    const months = [
      month('2026-03', '2026', 3, 8),
      month('2026-05', '2026', 5, 32),
    ];

    expect(adjacentTimelineMonths(months, '2026-04')).toEqual({
      previous: '2026-03',
      next: '2026-05',
    });
  });
});
