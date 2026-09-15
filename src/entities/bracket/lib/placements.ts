import type { BracketGame } from '@/shared/api/types';

/**
 * Roster id -> final place, for every place a winners-bracket game decides
 * (title game settles 1st/2nd, a 3rd-place game settles 3rd/4th, etc).
 * Teams that missed the playoffs never appear here.
 */
export function bracketPlacements(winners: BracketGame[] | undefined): Record<number, number> {
  const places: Record<number, number> = {};
  (winners ?? []).forEach((g) => {
    if (typeof g.p !== 'number') return;
    if (typeof g.w === 'number') places[g.w] = g.p;
    if (typeof g.l === 'number') places[g.l] = g.p + 1;
  });
  return places;
}

/**
 * Reorders standings so playoff-bracket finish wins over regular-season
 * record: rows with a bracket placement sort by that place, then every
 * unplaced (missed-the-playoffs) row keeps its regular-season relative order.
 */
export function finalFinishOrder<T extends { rosterId: number }>(
  standings: T[],
  placements: Record<number, number>,
): T[] {
  const placed = standings.filter((r) => placements[r.rosterId] != null);
  const unplaced = standings.filter((r) => placements[r.rosterId] == null);
  placed.sort((a, b) => placements[a.rosterId]! - placements[b.rosterId]!);
  return [...placed, ...unplaced];
}
