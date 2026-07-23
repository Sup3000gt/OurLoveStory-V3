import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { getOwnerSession } from '../lib/api';

export function useOwnerSession() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();

  return useQuery({
    queryKey: ['owner-session', isSignedIn, userId],
    queryFn: () => getOwnerSession(getToken),
    enabled: isLoaded && isSignedIn === true,
    staleTime: 0,
    retry: 3,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 2_000),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}
