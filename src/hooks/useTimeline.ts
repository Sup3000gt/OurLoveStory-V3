import { useQuery } from '@tanstack/react-query';
import { getTimeline } from '../lib/api';

export function useTimeline() {
  return useQuery({
    queryKey: ['timeline'],
    queryFn: getTimeline,
    staleTime: 30_000,
    retry: 1,
  });
}
