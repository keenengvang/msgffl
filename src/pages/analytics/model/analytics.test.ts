import { describe, expect, it } from 'vitest';
import type { SeasonWeeks } from '@/shared/api/types';
import { analyticsThrough, decidedGames, liveWeekFromRecords, luckTable, scoreSpread, standingsRace } from './analytics';

// 4 teams, 2 weeks. Week 1: 1(100) beats 2(90), 3(80) beats 4(70).
// Week 2: 1(60) loses to 3(65), 2(120) beats 4(50). Week 3 is unplayed (0–0).
const weeks: SeasonWeeks = {
  1: [
    { m: 1, r: 1, p: 100 },
    { m: 1, r: 2, p: 90 },
    { m: 2, r: 3, p: 80 },
    { m: 2, r: 4, p: 70 },
  ],
  2: [
    { m: 1, r: 1, p: 60 },
    { m: 1, r: 3, p: 65 },
    { m: 2, r: 2, p: 120 },
    { m: 2, r: 4, p: 50 },
  ],
  3: [
    { m: 1, r: 1, p: 0 },
    { m: 1, r: 2, p: 0 },
  ],
};

describe('analyticsThrough', () => {
  it('regular season only, and never the week in progress', () => {
    expect(analyticsThrough({ complete: true, playoffWeekStart: 15, liveWeek: 17 })).toBe(14);
    expect(analyticsThrough({ complete: false, playoffWeekStart: 15, liveWeek: 6 })).toBe(5);
    expect(analyticsThrough({ complete: false, playoffWeekStart: 15, liveWeek: 1 })).toBe(0);
  });
});

describe('liveWeekFromRecords', () => {
  it('is one past the most games anyone has finished — a final week is never treated as live', () => {
    // Week 6 is final (6 games on the books), week 7 hasn't scored yet.
    expect(liveWeekFromRecords([{ w: 4, l: 2, t: 0 }, { w: 2, l: 3, t: 1 }])).toBe(7);
    expect(liveWeekFromRecords([{ w: 0, l: 0, t: 0 }])).toBe(1);
    expect(liveWeekFromRecords([])).toBe(1);
  });
});

describe('decidedGames', () => {
  it('one row per team per decided game, skipping unplayed 0–0 pairs and weeks past `through`', () => {
    expect(decidedGames(weeks, 3)).toHaveLength(8);
    expect(decidedGames(weeks, 1)).toHaveLength(4);
    expect(decidedGames(undefined, 5)).toEqual([]);
  });
});

describe('luckTable', () => {
  it('actual vs all-play record, luckiest first', () => {
    const rows = luckTable(decidedGames(weeks, 2));
    const by = Object.fromEntries(rows.map((r) => [r.rosterId, r]));
    // Team 3: scored 80, 65 → all-play wk1 beats 4 only (1–2), wk2 beats 1, 4 (2–1) → 3–3; actual 2–0.
    expect(by[3]).toMatchObject({ w: 2, l: 0, apW: 3, apL: 3, winPct: 1, apPct: 0.5, luck: 0.5 });
    // Team 2: scored 90, 120 → all-play 2–1 then 3–0 → 5–1; actual 1–1 → unlucky.
    expect(by[2]).toMatchObject({ w: 1, l: 1, apW: 5, apL: 1 });
    expect(by[2]!.luck).toBeCloseTo(0.5 - 5 / 6);
    expect(rows[0]!.rosterId).toBe(3);
    expect(rows.at(-1)!.rosterId).toBe(2);
  });

  it('ties count half, on both records', () => {
    const rows = luckTable(decidedGames({ 1: [{ m: 1, r: 1, p: 50 }, { m: 1, r: 2, p: 50 }] }, 1));
    expect(rows[0]).toMatchObject({ t: 1, apT: 1, winPct: 0.5, apPct: 0.5, luck: 0 });
  });
});

describe('standingsRace', () => {
  it('rank after each week by wins, then points-for', () => {
    const race = standingsRace(decidedGames(weeks, 2), [1, 2, 3, 4], 2);
    const by = Object.fromEntries(race.map((r) => [r.rosterId, r.ranks]));
    // After wk1: 1 (1W,100) > 3 (1W,80) > 2 (0W,90) > 4.
    // After wk2: 3 (2W) > 2 (1W,210) > 1 (1W,160) > 4.
    expect(by).toEqual({ 1: [1, 3], 2: [3, 2], 3: [2, 1], 4: [4, 4] });
  });
});

describe('scoreSpread', () => {
  it('every weekly score with average, range and standard deviation', () => {
    const rows = scoreSpread(decidedGames(weeks, 2));
    const two = rows.find((r) => r.rosterId === 2)!;
    expect(two).toMatchObject({ avg: 105, min: 90, max: 120, sd: 15 });
    expect(two.scores).toEqual([
      { week: 1, pts: 90 },
      { week: 2, pts: 120 },
    ]);
    expect(rows[0]!.rosterId).toBe(2); // highest average first
  });
});
