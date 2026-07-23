import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import {
  getUploadSession,
} from '../lib/api';

export function uploadSessionQueryKey(
  sessionId: string,
  userId?: string | null,
) {
  const key = [
    'upload-session',
    sessionId,
  ] as const;
  return userId === undefined
    ? key
    : [...key, userId] as const;
}

export function useUploadSession(
  sessionId: string | undefined,
  enabled: boolean,
) {
  const { userId, getToken } = useAuth();

  return useQuery({
    queryKey: uploadSessionQueryKey(sessionId ?? '', userId),
    queryFn: () =>
      getUploadSession(
        sessionId!,
        getToken,
      ),
    enabled:
      enabled
      && Boolean(sessionId),
    staleTime: 0,
    retry: 1,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}
