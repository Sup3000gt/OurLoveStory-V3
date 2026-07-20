import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { getMemories } from '../lib/api';

export function useMemories() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  return useQuery({
    queryKey: ['memories', isSignedIn],
    queryFn: () => getMemories(isSignedIn ? getToken : undefined),
    enabled: isLoaded,
    staleTime: 30_000,
    retry: 1,
  });
}
