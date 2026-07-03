import { useSearch } from '@tanstack/react-router';
import { activeLeague, leagueOf } from '../lib/activeLeague';
import { useLeagueChain } from './useLeagueChain';

/** Season selection: the root `?season=` search param, defaulting to the
    active league (newest complete/in-season) when absent. */
export function useSeason() {
  const search = useSearch({ strict: false }) as { season?: string };
  const chain = useLeagueChain();
  const fallback = chain.data ? activeLeague(chain.data) : undefined;
  const league = leagueOf(chain.data, search.season) ?? fallback;
  return {
    season: league?.season,
    league,
    chain: chain.data,
    chainQuery: chain,
  };
}
