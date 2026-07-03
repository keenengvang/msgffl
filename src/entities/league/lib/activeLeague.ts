import type { League } from '@/shared/api/types';

/** The season shown by default: newest complete/in-season league, else newest. */
export function activeLeague(chain: League[]): League | undefined {
  return chain.find((l) => l.status === 'complete' || l.status === 'in_season') ?? chain[0];
}

/** Newest league in the chain — Sleeper mints a new league_id per season. */
export function newestLeague(chain: League[] | undefined): League | undefined {
  return (chain ?? []).reduce<League | undefined>(
    (best, l) => (!best || Number(l.season) > Number(best.season) ? l : best),
    undefined,
  );
}

export function leagueOf(chain: League[] | undefined, season: string | undefined): League | undefined {
  if (!chain || !season) return undefined;
  return chain.find((l) => l.season === season);
}

/** Freshness rule used across queries: completed seasons are immutable. */
export function staleFor(league: League | undefined, liveMs: number): number {
  return league?.status === 'complete' ? Infinity : liveMs;
}
