import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/sleeper';
import { qk } from '@/shared/api/queryKeys';
import type { League, Matchup, SeasonWeeks } from '@/shared/api/types';
import { staleFor } from '@/entities/league/lib/activeLeague';

/** All 17 weeks of one season, trimmed to {m,r,p} before entering the cache. */
export function useSeasonWeeks(league: League | undefined) {
  return useQuery({
    queryKey: qk.weeks(league?.league_id ?? ''),
    enabled: !!league,
    queryFn: async () => {
      const nums = Array.from({ length: 17 }, (_, i) => i + 1);
      const all = await Promise.all(
        nums.map((w) =>
          api<Matchup[]>(`/league/${league!.league_id}/matchups/${w}`).catch(() => [] as Matchup[]),
        ),
      );
      const trimmed: SeasonWeeks = {};
      nums.forEach((w, i) => {
        trimmed[w] = (all[i] ?? []).map((m) => ({ m: m.matchup_id, r: m.roster_id, p: m.points || 0 }));
      });
      return trimmed;
    },
    staleTime: staleFor(league, 60_000),
  });
}
