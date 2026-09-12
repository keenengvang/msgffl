import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/sleeper';
import { qk } from '@/shared/api/queryKeys';
import type { League, Matchup } from '@/shared/api/types';
import { staleFor } from '@/entities/league/lib/activeLeague';

/** One week's matchups with the full per-player breakdown (starters, full
    roster, players_points) — unlike useSeasonWeeks/useLiveWeek, nothing is
    trimmed away here, since the matchup detail page needs it. Fetched
    per-week on demand rather than folded into the 17-week bundle, which is
    deliberately kept minimal.

    Polls every 60s while the league is in season, same as useLiveWeek —
    otherwise a box score left open during the game would freeze at whatever
    players_points looked like on the initial load. */
export function useMatchupWeekDetail(league: League | undefined, week: number) {
  const live = league?.status === 'in_season';
  return useQuery({
    queryKey: qk.matchupDetail(league?.league_id ?? '', week),
    enabled: !!league && week > 0,
    queryFn: () => api<Matchup[]>(`/league/${league!.league_id}/matchups/${week}`),
    staleTime: staleFor(league, 60_000),
    refetchInterval: live ? 60_000 : false,
  });
}
