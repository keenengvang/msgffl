import type { TrimmedMatchup } from '@/shared/api/types';

export type MatchupPair = [TrimmedMatchup, TrimmedMatchup];

/** Group one week's entries by matchup_id into sorted 2-team pairs. */
export function pairMatchups(list: TrimmedMatchup[]): MatchupPair[] {
  const by: Record<number, TrimmedMatchup[]> = {};
  (list ?? []).forEach((e) => {
    if (e.m == null) return;
    (by[e.m] = by[e.m] ?? []).push(e);
  });
  return Object.values(by)
    .filter((p): p is TrimmedMatchup[] & { length: 2 } => p.length === 2)
    .map((p) => p.sort((a, b) => a.r - b.r) as MatchupPair);
}
