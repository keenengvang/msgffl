import { api } from '@/shared/api/sleeper';
import { LEAGUE_ID } from '@/shared/config/constants';
import type { League, LeagueUser, NflState } from '@/shared/api/types';
import { walkChain } from './walkChain';

/** The season chain, newest first.
 *
 * `walkChain` only walks *backwards* down previous_league_id, so on its own it
 * stops at whatever season LEAGUE_ID names — the league Sleeper minted for the
 * next season is invisible to it. That's what this adds: probe a few members'
 * leagues for one chained to our newest, so a new season appears on the site
 * the day the commish creates it, without a code change.
 *
 * Lives here rather than inside the query hook because the chat function needs
 * the same chain; a server that walked back from LEAGUE_ID alone would answer
 * every question about a season the league has already left.
 */
export async function fetchChain(ns: NflState | null): Promise<League[]> {
  const chain = await walkChain(LEAGUE_ID);
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
