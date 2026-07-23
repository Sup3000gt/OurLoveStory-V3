import { useInfiniteQuery } from '@tanstack/react-query';
import { getMemories } from '../lib/api';
import { parseTimelineMonthKey } from '../lib/timeline';

export function useTimelineMonth(monthKey: string) {
  const month = parseTimelineMonthKey(monthKey);

  return useInfiniteQuery({
    queryKey: ['timeline-month', monthKey],
    queryFn: ({ pageParam }) => getMemories(undefined, {
      cursor: pageParam,
      limit: 12,
      year: month?.year ?? null,
      month: month?.month ?? null,
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: month !== null,
    staleTime: 30_000,
    retry: 1,
  });
}
