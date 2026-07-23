import { useAuth } from '@clerk/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getMemories, type MemoryPageOptions } from '../lib/api';

export function useMemories(options: MemoryPageOptions = {}) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const memoryOptions = useMemo(() => ({
    cursor: options.cursor ?? null,
    limit: options.limit ?? 12,
    query: options.query ?? null,
    category: options.category ?? null,
    year: options.year ?? null,
    month: options.month ?? null,
  }), [
    options.category,
    options.cursor,
    options.limit,
    options.month,
    options.query,
    options.year,
  ]);

  return useInfiniteQuery({
    queryKey: ['memories', memoryOptions, isSignedIn],
    queryFn: ({ pageParam }) => getMemories(
      isSignedIn ? getToken : undefined,
      { ...memoryOptions, cursor: pageParam },
    ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isLoaded,
    staleTime: 30_000,
    retry: 1,
  });
}
