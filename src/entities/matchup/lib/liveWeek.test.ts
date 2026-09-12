import { describe, expect, it } from 'vitest';
import type { TrimmedMatchup } from '@/shared/api/types';
import { liveWeekFor, weekPulse } from './liveWeek';

const e = (m: number, r: number, p: number): TrimmedMatchup => ({ m, r, p });

describe('liveWeekFor', () => {
  it('uses the title week for complete seasons (capped at 17)', () => {
    expect(liveWeekFor({ status: 'complete', playoffWeekStart: 15, nflSeason: '2026', nflWeek: 1, season: '2025' })).toBe(17);
  });

  it('uses the live NFL week only when it belongs to the viewed season', () => {
    expect(liveWeekFor({ status: 'in_season', playoffWeekStart: 15, nflSeason: '2026', nflWeek: 1, season: '2026' })).toBe(1);
    expect(liveWeekFor({ status: 'in_season', playoffWeekStart: 15, nflSeason: '2026', nflWeek: 7, season: '2024' })).toBe(1);
  });
});

describe('weekPulse', () => {
  it('counts only games with points on the board', () => {
    // Two games live, one not kicked off yet.
    const pulse = weekPulse([
      e(1, 1, 120), e(1, 2, 100),
      e(2, 3, 90), e(2, 4, 89),
      e(3, 5, 0), e(3, 6, 0),
    ]);
    expect(pulse.games).toBe(3);
    expect(pulse.scored).toBe(2);
  });

  it('finds the top score and the tightest decided game', () => {
    const pulse = weekPulse([
      e(1, 1, 120), e(1, 2, 100),
      e(2, 3, 90), e(2, 4, 89),
    ]);
    expect(pulse.top).toEqual({ rosterId: 1, points: 120 });
    expect(pulse.closest).toEqual({ winner: 3, loser: 4, margin: 1 });
  });

  it('ignores a zero margin — that is an unplayed side, not a tie', () => {
    // Roster 2 has not scored, so this is not the week's closest game.
    const pulse = weekPulse([e(1, 1, 80), e(1, 2, 0), e(2, 3, 90), e(2, 4, 85)]);
    expect(pulse.closest).toEqual({ winner: 3, loser: 4, margin: 5 });
  });

  it('is empty for a week that has not started', () => {
    expect(weekPulse([e(1, 1, 0), e(1, 2, 0)])).toEqual({ games: 1, scored: 0, top: null, closest: null });
    expect(weekPulse(undefined)).toEqual({ games: 0, scored: 0, top: null, closest: null });
  });
});
