import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/sleeper';
import { qk } from '@/shared/api/queryKeys';
import type { League, Matchup } from '@/shared/api/types';
import { staleFor } from '@/entities/league/lib/activeLeague';
import { loadSeasonLineups } from '../lib/loadSeasonLineups';

/** Every regular-season week's lineups (starters + per-player points).
    ~14 requests, so it's opt-in: pass `enabled` from the view that needs it. */
export function useSeasonLineups(league: League | undefined, enabled = true) {
  const lastRegular = (league?.settings?.playoff_week_start ?? 15) - 1;
  return useQuery({
    queryKey: qk.lineups(league?.league_id ?? ''),
    enabled: enabled && !!league,
    queryFn: () => loadSeasonLineups(lastRegular, (w) => api<Matchup[]>(`/league/${league!.league_id}/matchups/${w}`)),
    staleTime: staleFor(league, 10 * 60_000),
  });
}
