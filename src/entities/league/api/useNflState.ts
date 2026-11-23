import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/sleeper';
import { qk } from '@/shared/api/queryKeys';
import type { NflState } from '@/shared/api/types';

/** Current NFL season/week. Resolves to null on failure so the chain can
    still load (mirrors legacy's .catch(() => null)). */
export function useNflState() {
  return useQuery({
    queryKey: qk.nflState,
    // eslint-disable-next-line no-restricted-syntax -- null is load-bearing: useLeagueChain waits for nflState.data !== undefined, so a failure must resolve null for the chain to load without NFL state; never persisted, 5 min (reviewed 2026-11-23)
    queryFn: () => api<NflState>('/state/nfl').catch(() => null),
    staleTime: 5 * 60_000,
  });
}
