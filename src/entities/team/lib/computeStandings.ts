import { avatarUrl } from '@/shared/api/sleeper';
import { ptsOf, paOf } from '@/shared/lib/points';
import type { LeagueUser, Roster } from '@/shared/api/types';
import type { StandingRow } from '../model/types';

export function usersById(users: LeagueUser[]): Record<string, LeagueUser> {
  const by: Record<string, LeagueUser> = {};
  users.forEach((u) => (by[u.user_id] = u));
  return by;
}

/** Standings rows sorted wins desc, then PF desc. */
export function computeStandings(
  rosters: Roster[],
  byId: Record<string, LeagueUser>,
): StandingRow[] {
  const rows = (rosters ?? []).map((r): StandingRow => {
    const u = byId[r.owner_id];
    const s = r.settings ?? {};
    return {
      rosterId: r.roster_id,
      ownerId: r.owner_id,
      team: `${u?.metadata?.team_name || u?.display_name || 'Team ' + r.roster_id}`.trim(),
      owner: u?.display_name ?? '—',
      avatar: avatarUrl(u?.avatar),
      w: s.wins ?? 0,
      l: s.losses ?? 0,
      t: s.ties ?? 0,
      pf: ptsOf(s),
      pa: paOf(s),
      recordStr: r.metadata?.record ?? '',
    };
  });
  rows.sort((a, b) => b.w - a.w || b.pf - a.pf);
  return rows;
}
