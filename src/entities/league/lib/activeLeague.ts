import type { League } from '@/shared/api/types';

/** The season shown by default: newest complete/in-season league, else newest. */
export function activeLeague(chain: League[]): League | undefined {
  return chain.find((l) => l.status === 'complete' || l.status === 'in_season') ?? chain[0];
}

export function leagueOf(chain: League[] | undefined, season: string | undefined): League | undefined {
  if (!chain || !season) return undefined;
  return chain.find((l) => l.season === season);
}

/** Freshness rule used across queries: completed seasons are immutable. */
export function staleFor(league: League | undefined, liveMs: number): number {
  return league?.status === 'complete' ? Infinity : liveMs;
}
