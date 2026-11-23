import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/sleeper';
import { qk } from '@/shared/api/queryKeys';
import type { BracketGame, League } from '@/shared/api/types';
import { staleFor } from '@/entities/league/lib/activeLeague';
import { loadBrackets, type Brackets } from '../lib/loadBrackets';

export type { Brackets };

/** Winners + losers playoff brackets in one query. */
export function useBrackets(league: League | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.brackets(league),
    enabled: enabled && !!league,
    queryFn: () => loadBrackets((side) => api<BracketGame[] | null>(`/league/${league!.league_id}/${side}_bracket`)),
    staleTime: staleFor(league, 5 * 60_000),
  });
}
