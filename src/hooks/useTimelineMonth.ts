import { useInfiniteQuery } from '@tanstack/react-query';
import { getMemories } from '../lib/api';
import { parseTimelineMonthKey } from '../lib/timeline';

export function useTimelineMonth(monthKey: string) {
  return useInfiniteQuery({
    queryKey: ['timeline-month', monthKey],
    queryFn: ({ pageParam }) => getMemories(undefined, {
      cursor: pageParam,
      limit: 12,
      month: monthKey,
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: parseTimelineMonthKey(monthKey) !== null,
    staleTime: 30_000,
    retry: 1,
  });
}
