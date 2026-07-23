import type { TimelineMonth, TimelineResponse } from '../../shared/contracts';

export function timelineYearAnchor(year: number): string {
  return `year-${year}`;
}

export function visibleTimelineMonths(timeline: TimelineResponse): TimelineMonth[] {
  return timeline.years
    .flatMap((year) => year.months)
    .filter((month) => month.photoCount > 0)
    .slice()
    .sort((left, right) => Number(left.year) - Number(right.year) || left.month - right.month);
}

export function adjacentTimelineMonths(
  months: TimelineMonth[],
  currentKey: string,
): { previous: string | null; next: string | null } {
  const visibleMonths = months
    .filter((month) => month.photoCount > 0)
    .slice()
    .sort((left, right) => Number(left.year) - Number(right.year) || left.month - right.month);
  const currentIndex = visibleMonths.findIndex((month) => month.key === currentKey);

  if (currentIndex === -1) return { previous: null, next: null };

  return {
    previous: visibleMonths[currentIndex - 1]?.key ?? null,
    next: visibleMonths[currentIndex + 1]?.key ?? null,
  };
}
