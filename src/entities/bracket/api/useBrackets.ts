import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/sleeper';
import { qk } from '@/shared/api/queryKeys';
import type { BracketGame, League } from '@/shared/api/types';
import { staleFor } from '@/entities/league/lib/activeLeague';

export interface Brackets {
  winners: BracketGame[];
  losers: BracketGame[];
}

/** Winners + losers playoff brackets in one query. */
export function useBrackets(league: League | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.brackets(league?.league_id ?? ''),
    enabled: enabled && !!league,
    queryFn: async (): Promise<Brackets> => {
      const [winners, losers] = await Promise.all([
        api<BracketGame[]>(`/league/${league!.league_id}/winners_bracket`).catch(() => [] as BracketGame[]),
        api<BracketGame[]>(`/league/${league!.league_id}/losers_bracket`).catch(() => [] as BracketGame[]),
      ]);
      return { winners, losers };
    },
    staleTime: staleFor(league, 5 * 60_000),
  });
}
