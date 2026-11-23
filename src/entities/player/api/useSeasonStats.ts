import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/sleeper';
import { qk } from '@/shared/api/queryKeys';
import type { League, SeasonStats } from '@/shared/api/types';
import { staleFor } from '@/entities/league/lib/activeLeague';

/** Per-player season stat lines for one season. A failed fetch rejects: a
    complete season's stats are cached forever and persisted, so `{}` here
    would show every player at zero points for good. */
export function useSeasonStats(season: string | undefined, league: League | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.stats(season ?? '', league),
    // Wait for the league: keyed without it, a cold load fetches under 'live', then again under 'final'.
    enabled: enabled && !!season && !!league,
    queryFn: () => api<SeasonStats>(`/stats/nfl/regular/${season}`),
    staleTime: staleFor(league, 6 * 60 * 60_000),
  });
}
