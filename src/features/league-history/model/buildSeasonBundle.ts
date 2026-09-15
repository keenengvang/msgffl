import { api } from '@/shared/api/sleeper';
import type { BracketGame, League, LeagueUser, Matchup, Roster, TrimmedMatchup } from '@/shared/api/types';
import { computeStandings, usersById } from '@/entities/team/lib/computeStandings';
import { bracketPlacements, finalFinishOrder } from '@/entities/bracket/lib/placements';
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
  /** Final finish order once the season is complete (playoff bracket beats regular-season record); regular-season order while the season is live. */
  standings: StandingRow[];
  /** Always regular-season record order (wins desc, PF desc) — a seed, not a finish. Consumers that mean "who won the bracket" want `standings`/`champ`/`ru`, not this. */
  regularSeasonStandings: StandingRow[];
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

  // Regular-season order is only a tiebreak fallback for teams that missed the
  // playoffs — once the bracket has decided a season, its placements win.
  const regularStandings = computeStandings(rosters, usersById(users));
  const standings =
    lg.status === 'complete' ? finalFinishOrder(regularStandings, bracketPlacements(winners)) : regularStandings;
  const names: Record<number, BundleName> = {};
  standings.forEach((r) => (names[r.rosterId] = { team: r.team, owner: r.owner, ownerId: r.ownerId, av: r.avatar }));
  const weeks = weeksArr.map((wl) => (wl ?? []).map((m) => ({ m: m.matchup_id, r: m.roster_id, p: m.points || 0 })));
  const fin = winners.find((g) => g.p === 1);
  return {
    season: lg.season,
    status: lg.status,
    names,
    standings,
    regularSeasonStandings: regularStandings,
    weeks,
    champ: fin && typeof fin.w === 'number' ? (names[fin.w] ?? null) : null,
    ru: fin && typeof fin.l === 'number' ? (names[fin.l] ?? null) : null,
    sacko: standings[standings.length - 1] ?? null,
    pws: lg.settings?.playoff_week_start ?? 15,
  };
}
