import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import type {
  UploadSessionSummary,
} from '../../shared/contracts';
import {
  listUploadSessions,
} from '../lib/api';

export const uploadSessionsQueryKey = [
  'upload-sessions',
] as const;

export function useUploadSessions(
  enabled: boolean,
) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: uploadSessionsQueryKey,
    queryFn: () =>
      listUploadSessions(getToken),
    enabled,
    staleTime: 0,
    retry: 1,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

export function activeAppendSessionForMemory(
  sessions: UploadSessionSummary[],
  memoryId: string,
): UploadSessionSummary | null {
  return sessions.find((session) =>
    session.kind === 'append'
    && session.memoryId === memoryId
    && (
      session.status === 'uploading'
      || session.status === 'review'
    ),
  ) ?? null;
}

export function activeCreateSessions(
  sessions: UploadSessionSummary[],
): UploadSessionSummary[] {
  return sessions.filter((session) =>
    session.kind === 'create'
    && (
      session.status === 'uploading'
      || session.status === 'review'
    ),
  );
}