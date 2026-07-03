import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/sleeper';
import { qk } from '@/shared/api/queryKeys';
import { LEAGUE_ID } from '@/shared/config/constants';
import type { League, LeagueUser, NflState } from '@/shared/api/types';
import { walkChain } from '../lib/walkChain';
import { useNflState } from './useNflState';

async function fetchChain(ns: NflState | null): Promise<League[]> {
  const chain = await walkChain(LEAGUE_ID);
  // Auto-discover a newer season league created after this site was built:
  // probe the first few members' leagues for one chained to our newest.
  try {
    const newest = chain[0];
    if (ns && newest && Number(ns.season) > Number(newest.season)) {
      const users = await api<LeagueUser[]>(`/league/${newest.league_id}/users`);
      for (const u of users.slice(0, 3)) {
        const ls = await api<League[]>(`/user/${u.user_id}/leagues/nfl/${ns.season}`).catch(
          () => [] as League[],
        );
        const next = ls.find((l) => l.previous_league_id === newest.league_id);
        if (next) {
          chain.unshift(next);
          break;
        }
      }
    }
  } catch {
    // discovery is best-effort
  }
  return chain;
}

/** Season chain, newest first. Depends on nflState (which resolves even on error). */
export function useLeagueChain() {
  const nflState = useNflState();
  return useQuery({
    queryKey: qk.chain,
    enabled: nflState.data !== undefined,
    queryFn: () => fetchChain(nflState.data ?? null),
    staleTime: 60 * 60_000,
  });
}
