import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/sleeper';
import { qk } from '@/shared/api/queryKeys';
import type { League, SeasonStats } from '@/shared/api/types';
import { staleFor } from '@/entities/league/lib/activeLeague';

/** Per-player season stat lines for one season. */
export function useSeasonStats(season: string | undefined, league: League | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.stats(season ?? ''),
    enabled: enabled && !!season,
    queryFn: () => api<SeasonStats>(`/stats/nfl/regular/${season}`).catch(() => ({}) as SeasonStats),
    staleTime: staleFor(league, 6 * 60 * 60_000),
  });
}
