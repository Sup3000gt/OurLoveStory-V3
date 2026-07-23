import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import type { Memory } from '../../shared/contracts';
import { getMemory } from '../lib/api';

export function useMemory(
  memoryId: string | undefined,
  initialMemory: Memory | undefined,
) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();

  return useQuery({
    queryKey: ['memory', memoryId, isSignedIn, userId],
    queryFn: () => getMemory(
      memoryId!,
      isSignedIn ? getToken : undefined,
    ),
    enabled: isLoaded && Boolean(memoryId) && !initialMemory,
    staleTime: 30_000,
    retry: 1,
  });
}
