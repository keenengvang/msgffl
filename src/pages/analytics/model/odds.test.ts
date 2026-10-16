import { describe, expect, it } from 'vitest';
import type { SeasonWeeks } from '@/shared/api/types';
import { byeCount, oddsTimeline, playoffOdds } from './odds';

// 4 teams, 4-week regular season, 2 make the playoffs. Rotating schedule.
const pairs = [
  [[1, 2], [3, 4]],
  [[1, 3], [2, 4]],
  [[1, 4], [2, 3]],
  [[1, 2], [3, 4]],
];
const season = (scores: Record<number, number>, played: number): SeasonWeeks => {
  const out: SeasonWeeks = {};
  pairs.forEach((week, i) => {
    out[i + 1] = week.flatMap(([a, b], m) => [
      { m, r: a!, p: i < played ? scores[a!]! : 0 },
      { m, r: b!, p: i < played ? scores[b!]! : 0 },
    ]);
  });
  return out;
};
const base = { rosterIds: [1, 2, 3, 4], lastRegular: 4, playoffTeams: 2, sims: 2000 };

describe('byeCount', () => {
  it('pads the bracket to the next power of two', () => {
    expect([4, 6, 7, 8, 12].map(byeCount)).toEqual([0, 2, 1, 0, 4]);
  });
});

describe('playoffOdds', () => {
  it('is exact once nothing is left to play', () => {
    const weeks = season({ 1: 150, 2: 120, 3: 90, 4: 60 }, 4);
    const odds = playoffOdds({ ...base, weeks, asOf: 4 });
    expect(odds.map((o) => o.playoff)).toEqual([1, 1, 0, 0]);
    expect(odds.map((o) => o.last)).toEqual([0, 0, 0, 1]);
  });

  it('gives everyone the same shot before a game is played', () => {
    const weeks = season({ 1: 0, 2: 0, 3: 0, 4: 0 }, 0);
    for (const o of playoffOdds({ ...base, weeks, asOf: 0 })) expect(o.playoff).toBeCloseTo(0.5, 1);
  });

  it('a dominant team after three weeks is near-certain; a winless one is near-dead', () => {
    const weeks = season({ 1: 160, 2: 110, 3: 100, 4: 60 }, 3);
    const odds = Object.fromEntries(playoffOdds({ ...base, weeks, asOf: 3 }).map((o) => [o.rosterId, o]));
    expect(odds[1]!.playoff).toBeGreaterThan(0.99);
    expect(odds[4]!.playoff).toBeLessThan(0.05);
    expect(odds[4]!.last).toBeGreaterThan(0.9);
    const total = Object.values(odds).reduce((a, o) => a + o.playoff, 0);
    expect(total).toBeCloseTo(2); // exactly two spots, every simulation
  });

  it('is deterministic for the same seed', () => {
    const weeks = season({ 1: 120, 2: 110, 3: 100, 4: 90 }, 2);
    expect(playoffOdds({ ...base, weeks, asOf: 2 })).toEqual(playoffOdds({ ...base, weeks, asOf: 2 }));
  });
});

describe('oddsTimeline', () => {
  it('one point per week from preseason, sorted by current odds', () => {
    const weeks = season({ 1: 160, 2: 110, 3: 100, 4: 60 }, 4);
    const tl = oddsTimeline({ ...base, weeks, through: 4 });
    expect(tl[0]!.rosterId).toBe(1);
    expect(tl[0]!.playoff).toHaveLength(5);
    expect(tl[0]!.playoff.at(-1)).toBe(1);
    expect(tl.at(-1)!.now.last).toBe(1);
  });
});
