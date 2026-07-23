import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { getMemoryFacets } from '../lib/api';

export function useMemoryFacets() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();

  return useQuery({
    queryKey: ['memory-facets', isSignedIn, userId],
    queryFn: () => getMemoryFacets(isSignedIn ? getToken : undefined),
    enabled: isLoaded,
    staleTime: 30_000,
    retry: 1,
  });
}
