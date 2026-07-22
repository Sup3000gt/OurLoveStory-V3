import { useAuth } from '@clerk/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getMemories } from '../lib/api';

export function useMemories() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  return useInfiniteQuery({
    queryKey: ['memories', isSignedIn],
    queryFn: ({ pageParam }) => getMemories(
      isSignedIn ? getToken : undefined,
      { cursor: pageParam, limit: 12 },
    ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isLoaded,
    staleTime: 30_000,
    retry: 1,
  });
}
