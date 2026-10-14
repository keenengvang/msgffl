/**
 * What the bets function needs from Sleeper to enforce the kickoff lock: who
 * is in the league that season, each side's points that week, and whether the
 * week is over. Same pure functions the board renders with, so the server
 * can't lock a bet the page shows as open (or vice versa).
 */
import { api } from '@/shared/api/sleeper';
import type { Matchup } from '@/shared/api/types';
import { isLocked, sideScores, weekIsFinal } from '@/entities/bet/lib/resolveBet';
import type { Bet } from '@/entities/bet/model/types';
import { leagueForSeason, rostersFor } from './league';

export interface WeekFacts {
  /** owner_ids with a roster that season. */
  members: Set<string>;
  /** owner_id → roster_id that season, recorded on the bet when a side is set. */
  rosterOf: Record<string, number>;
  locked(bet: Pick<Bet, 'sideA' | 'sideB'> & Partial<Pick<Bet, 'rosterA' | 'rosterB'>>): boolean;
}

/** null when the league has no such season. Rejects when Sleeper is
    unreachable — the caller refuses the write rather than guess at a lock. */
export type FactsFor = (season: string, week: number) => Promise<WeekFacts | null>;

export const sleeperFacts: FactsFor = async (season, week) => {
  const found = await leagueForSeason(season);
  if (!found) return null;
  const { league, nfl } = found;
  const [{ rosters }, raw] = await Promise.all([
    rostersFor(league),
    // Uncached on purpose: this is the one number the lock turns on, and
    // writes are rare enough that a fresh read is cheap.
    api<Matchup[]>(`/league/${league.league_id}/matchups/${week}`),
  ]);
  const rosterOf: Record<string, number> = {};
  rosters.forEach((r) => (rosterOf[r.owner_id] = r.roster_id));
  const rows = raw.map((m) => ({ m: m.matchup_id, r: m.roster_id, p: m.points || 0 }));
  const final = weekIsFinal(
    { status: league.status, season, nflSeason: nfl.season, nflWeek: nfl.week },
    week,
  );
  return {
    members: new Set(Object.keys(rosterOf)),
    rosterOf,
    locked: (bet) => isLocked(sideScores(bet, rows, rosterOf), final),
  };
};
