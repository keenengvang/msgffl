import { describe, expect, it } from 'vitest';
import type { SeasonLineups, WeekLineup } from '@/shared/api/types';
import type { Position } from '@/shared/config/constants';
import { benchTable, lineupPosOf, optimalPoints, positionStrength, startedPoints, startingSlots } from './lineups';

const slots = startingSlots(['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'WRRB_FLEX', 'K', 'DEF', 'BN', 'BN', 'IR']);
const POS: Record<string, Position> = {
  qb: 'QB', qb2: 'QB', rb1: 'RB', rb2: 'RB', rb3: 'RB', wr1: 'WR', wr2: 'WR', wr3: 'WR', te: 'TE', te2: 'TE', k: 'K', d: 'DEF',
};
const posOf = (id: string) => POS[id];

// Started qb, rb1, rb2, wr1, wr2, te, flex=wr3, k, d. Bench: rb3 (30), te2 (12), qb2 (40).
const lu: WeekLineup = {
  r: 1,
  s: ['qb', 'rb1', 'rb2', 'wr1', 'wr2', 'te', 'wr3', 'k', 'd'],
  pp: { qb: 20, rb1: 15, rb2: 10, wr1: 18, wr2: 12, te: 8, wr3: 5, k: 9, d: 6, rb3: 30, te2: 12, qb2: 40 },
};

describe('startingSlots', () => {
  it('drops bench and IR, keeps order', () => {
    expect(slots).toEqual(['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'WRRB_FLEX', 'K', 'DEF']);
  });
});

describe('optimalPoints', () => {
  it('fills dedicated slots, then the flex with the best eligible leftover', () => {
    expect(startedPoints(lu)).toBe(103);
    // QB qb2 40, RB rb3 30 + rb1 15, WR 18 + 12, TE te2 12, FLEX best of rb2 10/wr3 5 → 10, K 9, DEF 6.
    expect(optimalPoints(slots, lu, posOf)).toBe(40 + 30 + 15 + 18 + 12 + 12 + 10 + 9 + 6);
  });

  it("a TE can't fill a WR/RB flex", () => {
    const l: WeekLineup = { r: 1, s: [], pp: { te: 50, te2: 40 } };
    expect(optimalPoints(['TE', 'WRRB_FLEX'], l, posOf)).toBe(50);
  });

  it("falls back to the dedicated slot a starter filled when the DB doesn't know him", () => {
    const l: WeekLineup = { r: 1, s: ['ghost'], pp: { ghost: 22 } };
    expect(optimalPoints(['QB'], l, lineupPosOf(() => undefined, l, ['QB']))).toBe(22);
  });
});

describe('benchTable', () => {
  it('efficiency, points left, and losses the best lineup would have won', () => {
    const lineups: SeasonLineups = { 1: [lu] };
    const games = [{ week: 1, r: 1, pts: 103, oppR: 2, opp: 150 }];
    const [row] = benchTable(games, lineups, slots, posOf);
    expect(row).toMatchObject({ actual: 103, optimal: 152, left: 49, blown: 1, games: 1 });
    expect(row!.efficiency).toBeCloseTo(103 / 152);
  });
});

describe('positionStrength', () => {
  it('credits flex starters to their real position, against the league average', () => {
    const lu2: WeekLineup = { r: 2, s: ['qb2', 'rb3'], pp: { qb2: 10, rb3: 20 } };
    const games = [
      { week: 1, r: 1, pts: 103, oppR: 2, opp: 30 },
      { week: 1, r: 2, pts: 30, oppR: 1, opp: 103 },
    ];
    const { rows, league } = positionStrength(games, { 1: [lu, lu2] }, slots, posOf, [1, 2]);
    expect(rows[0]!.perGame.WR).toBe(35); // wr1 + wr2 + flex wr3
    expect(league.QB).toBe(15);
    expect(rows[1]!.diff.QB).toBe(-5);
  });
});
