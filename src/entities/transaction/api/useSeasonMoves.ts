import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/sleeper';
import { qk } from '@/shared/api/queryKeys';
import type { League, Transaction } from '@/shared/api/types';
import { staleFor } from '@/entities/league/lib/activeLeague';
import { loadSeasonMoves } from '../lib/loadSeasonMoves';

/** The season's waiver claims, free-agent adds and trades (18 requests —
    opt-in via `enabled`). A failed leg fails the query; see loadSeasonMoves. */
export function useSeasonMoves(league: League | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.moves(league?.league_id ?? ''),
    enabled: enabled && !!league,
    queryFn: () => loadSeasonMoves(league!.season, (leg) => api<Transaction[]>(`/league/${league!.league_id}/transactions/${leg}`)),
    staleTime: staleFor(league, 10 * 60_000),
  });
}
