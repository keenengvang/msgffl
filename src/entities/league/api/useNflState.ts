import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/sleeper';
import { qk } from '@/shared/api/queryKeys';
import type { NflState } from '@/shared/api/types';

/** Current NFL season/week. Resolves to null on failure so the chain can
    still load (mirrors legacy's .catch(() => null)). */
export function useNflState() {
  return useQuery({
    queryKey: qk.nflState,
    queryFn: () => api<NflState>('/state/nfl').catch(() => null),
    staleTime: 5 * 60_000,
  });
}
