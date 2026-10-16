/**
 * What the bets function needs from Sleeper: who is in the league that season,
 * and which roster each of them runs (recorded on the bet when a side is set,
 * so its scores still resolve if the team later changes owners).
 */
import { leagueForSeason, rostersFor } from './league';

export interface SeasonFacts {
  /** owner_ids with a roster that season. */
  members: Set<string>;
  /** owner_id → roster_id that season. */
  rosterOf: Record<string, number>;
}

/** null when the league has no such season. Rejects when Sleeper is
    unreachable — the caller refuses the write rather than guess at membership. */
export type FactsFor = (season: string) => Promise<SeasonFacts | null>;

export const sleeperFacts: FactsFor = async (season) => {
  const found = await leagueForSeason(season);
  if (!found) return null;
  const { rosters } = await rostersFor(found.league);
  const rosterOf: Record<string, number> = {};
  rosters.forEach((r) => (rosterOf[r.owner_id] = r.roster_id));
  return { members: new Set(Object.keys(rosterOf)), rosterOf };
};
