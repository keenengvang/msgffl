import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/sleeper';
import { qk } from '@/shared/api/queryKeys';
import type { League, LeagueUser, Roster } from '@/shared/api/types';
import { staleFor } from '@/entities/league/lib/activeLeague';
import { computeStandings, usersById } from '../lib/computeStandings';

export function useLeagueUsers(league: League | undefined) {
  return useQuery({
    queryKey: qk.users(league?.league_id ?? ''),
    enabled: !!league,
    queryFn: () => api<LeagueUser[]>(`/league/${league!.league_id}/users`),
    staleTime: staleFor(league, 5 * 60_000),
  });
}

export function useRosters(league: League | undefined) {
  return useQuery({
    queryKey: qk.rosters(league?.league_id ?? ''),
    enabled: !!league,
    queryFn: () => api<Roster[]>(`/league/${league!.league_id}/rosters`),
    staleTime: staleFor(league, 5 * 60_000),
  });
}

/** Users + rosters composed into sorted standings. */
export function useStandings(league: League | undefined) {
  const users = useLeagueUsers(league);
  const rosters = useRosters(league);

  const byId = useMemo(() => (users.data ? usersById(users.data) : undefined), [users.data]);
  const standings = useMemo(
    () => (rosters.data && byId ? computeStandings(rosters.data, byId) : undefined),
    [rosters.data, byId],
  );

  return {
    standings,
    usersById: byId,
    isLoading: users.isLoading || rosters.isLoading,
    error: users.error ?? rosters.error,
  };
}
