import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { getOwnerSession } from '../lib/api';

export function useOwnerSession() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  return useQuery({
    queryKey: ['owner-session', isSignedIn],
    queryFn: () => getOwnerSession(getToken),
    enabled: isLoaded && Boolean(isSignedIn),
    staleTime: 60_000,
    retry: 1,
  });
}
