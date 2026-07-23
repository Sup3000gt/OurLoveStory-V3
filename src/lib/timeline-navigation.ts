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
  const timelineMonths = months
    .slice()
    .sort((left, right) => Number(left.year) - Number(right.year) || left.month - right.month);
  const currentIndex = timelineMonths.findIndex((month) => month.key === currentKey);
  const insertionIndex = currentIndex === -1
    ? timelineMonths.findIndex((month) => month.key > currentKey)
    : currentIndex;
  const nextIndex = currentIndex === -1 ? insertionIndex : currentIndex + 1;

  return {
    previous: timelineMonths
      .slice(0, insertionIndex === -1 ? timelineMonths.length : insertionIndex)
      .reverse()
      .find((month) => month.photoCount > 0)?.key ?? null,
    next: timelineMonths
      .slice(nextIndex === -1 ? timelineMonths.length : nextIndex)
      .find((month) => month.photoCount > 0)?.key ?? null,
  };
}
