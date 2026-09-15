import { describe, expect, it } from 'vitest';
import type { BracketGame } from '@/shared/api/types';
import { bracketPlacements, finalFinishOrder } from './placements';

describe('bracketPlacements', () => {
  it('reads 1st/2nd from the title game and 3rd/4th from a placement game', () => {
    const winners: BracketGame[] = [
      { r: 1, m: 1, t1: 1, t2: 4, w: 1, l: 4 },
      { r: 1, m: 2, t1: 2, t2: 3, w: 2, l: 3 },
      { r: 2, m: 3, p: 1, w: 1, l: 2 },
      { r: 2, m: 4, p: 3, w: 3, l: 4 },
    ];
    expect(bracketPlacements(winners)).toEqual({ 1: 1, 2: 2, 3: 3, 4: 4 });
  });

  it('returns an empty map when there is no bracket', () => {
    expect(bracketPlacements(undefined)).toEqual({});
    expect(bracketPlacements([])).toEqual({});
  });
});

describe('finalFinishOrder', () => {
  const row = (rosterId: number, w: number) => ({ rosterId, w });

  it('lets bracket placement beat regular-season record for the podium', () => {
    // b led the regular season (9 wins) but lost the final to a; a is the real champ.
    const standings = [row(2, 9), row(1, 8), row(3, 6), row(4, 4)];
    const placements = { 1: 1, 2: 2 };
    expect(finalFinishOrder(standings, placements).map((r) => r.rosterId)).toEqual([1, 2, 3, 4]);
  });

  it('keeps regular-season order for teams the bracket never placed', () => {
    const standings = [row(1, 9), row(2, 8), row(3, 6), row(4, 2)];
    const placements = { 1: 1, 2: 2 };
    expect(finalFinishOrder(standings, placements).map((r) => r.rosterId)).toEqual([1, 2, 3, 4]);
  });
});
