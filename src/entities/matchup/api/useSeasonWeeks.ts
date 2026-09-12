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

/** The one week that can still change, polled on its own.
 *
 * The 17-week query above must NOT poll: re-running it re-downloads sixteen
 * immutable weeks to learn about one, which is ~1000 Sleeper requests an hour
 * per open tab. staleTime alone doesn't refetch anything either (it only marks
 * data stale, and the provider turns off refetch-on-focus), so live scores sat
 * frozen until a reload. This fetches the live week only, every 60s, and
 * TanStack pauses the interval while the tab is hidden. */
export function useLiveWeek(league: League | undefined, week: number) {
  const live = league?.status === 'in_season';
  return useQuery({
    queryKey: qk.liveWeek(league?.league_id ?? '', week),
    enabled: !!league && live && week > 0,
    queryFn: async () => {
      const raw = await api<Matchup[]>(`/league/${league!.league_id}/matchups/${week}`).catch(
        () => [] as Matchup[],
      );
      return raw.map((m) => ({ m: m.matchup_id, r: m.roster_id, p: m.points || 0 }));
    },
    staleTime: 60_000,
    refetchInterval: live ? 60_000 : false,
  });
}
