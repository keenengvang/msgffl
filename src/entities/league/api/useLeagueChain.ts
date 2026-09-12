import { useQuery } from '@tanstack/react-query';
import { qk } from '@/shared/api/queryKeys';
import { fetchChain } from '../lib/fetchChain';
import { useNflState } from './useNflState';

/** Season chain, newest first. Depends on nflState (which resolves even on error).
    The chain itself is built by fetchChain, shared with the chat function. */
export function useLeagueChain() {
  const nflState = useNflState();
  return useQuery({
    queryKey: qk.chain,
    enabled: nflState.data !== undefined,
    queryFn: () => fetchChain(nflState.data ?? null),
    staleTime: 60 * 60_000,
  });
}
