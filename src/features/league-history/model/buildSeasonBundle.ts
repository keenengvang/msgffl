import { api } from '@/shared/api/sleeper';
import type { BracketGame, League, LeagueUser, Matchup, Roster, TrimmedMatchup } from '@/shared/api/types';
import { computeStandings, usersById } from '@/entities/team/lib/computeStandings';
import type { StandingRow } from '@/entities/team/model/types';

export interface BundleName {
  team: string;
  owner: string;
  ownerId: string;
  av: string;
}

export interface SeasonBundle {
  season: string;
  status: League['status'];
  names: Record<number, BundleName>;
  standings: StandingRow[];
  /** weeks[wi] = week wi+1, trimmed entries. */
  weeks: TrimmedMatchup[][];
  champ: BundleName | null;
  ru: BundleName | null;
  sacko: StandingRow | null;
  /** playoff_week_start — H2H and record scans treat weeks >= pws as playoffs. */
  pws: number;
}

/** One season's full history payload (users/rosters/winners/17 weeks). */
export async function buildSeasonBundle(lg: League): Promise<SeasonBundle> {
  const [users, rosters, winners, weeksArr] = await Promise.all([
    api<LeagueUser[]>(`/league/${lg.league_id}/users`),
    api<Roster[]>(`/league/${lg.league_id}/rosters`),
    api<BracketGame[]>(`/league/${lg.league_id}/winners_bracket`).catch(() => [] as BracketGame[]),
    Promise.all(
      Array.from({ length: 17 }, (_, i) =>
        api<Matchup[]>(`/league/${lg.league_id}/matchups/${i + 1}`).catch(() => [] as Matchup[]),
      ),
    ),
  ]);

  const standings = computeStandings(rosters, usersById(users));
  const names: Record<number, BundleName> = {};
  standings.forEach((r) => (names[r.rosterId] = { team: r.team, owner: r.owner, ownerId: r.ownerId, av: r.avatar }));
  const weeks = weeksArr.map((wl) => (wl ?? []).map((m) => ({ m: m.matchup_id, r: m.roster_id, p: m.points || 0 })));
  const fin = winners.find((g) => g.p === 1);
  return {
    season: lg.season,
    status: lg.status,
    names,
    standings,
    weeks,
    champ: fin && typeof fin.w === 'number' ? (names[fin.w] ?? null) : null,
    ru: fin && typeof fin.l === 'number' ? (names[fin.l] ?? null) : null,
    sacko: standings[standings.length - 1] ?? null,
    pws: lg.settings?.playoff_week_start ?? 15,
  };
}
