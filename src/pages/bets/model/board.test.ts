import { describe, expect, it } from 'vitest';
import type { BetRecord } from '@/entities/bet/model/types';
import { buildBoard, lastScoredWeek } from './board';

const bet = (id: string, week: number, over: Partial<BetRecord> = {}): BetRecord => ({
  id,
  season: '2025',
  week,
  sideA: 'ua',
  sideB: 'ub',
  rosterA: null,
  rosterB: null,
  terms: 'a keg',
  winner: null,
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
  version: 'v1',
  ...over,
});

describe('buildBoard', () => {
  const ctx = {
    rosterOf: { ua: 1, ub: 2 },
    rowsFor: (w: number) =>
      w === 4
        ? [
            { m: 1, r: 1, p: 140 },
            { m: 1, r: 2, p: 90 },
          ]
        : w === 5
          ? [
              { m: 1, r: 1, p: 12 },
              { m: 1, r: 2, p: 0 },
            ]
          : [],
    isFinal: (w: number) => w < 5,
  };

  it('groups live bets by week (newest first), settles, locks and tallies', () => {
    const board = buildBoard(
      [bet('a', 4, { winner: 'A' }), bet('e', 4), bet('b', 5), bet('c', 6), bet('d', 4, { winner: 'A', deletedAt: 'x' })],
      ctx,
    );
    expect(board.weeks.map((w) => [w.week, w.entries.map((e) => e.bet.id)])).toEqual([
      [6, ['c']],
      [5, ['b']],
      [4, ['a', 'e']],
    ]);
    const [w6, w5, w4] = board.weeks;
    expect(w4!.entries[0]).toMatchObject({ outcome: { kind: 'settled', winner: 'A' }, locked: true });
    expect(w4!.entries[1]).toMatchObject({ outcome: { kind: 'ruling' }, locked: true }); // week over, nobody ruled
    expect(w5!.entries[0]).toMatchObject({ outcome: { kind: 'live' }, locked: true });
    expect(w6!.entries[0]).toMatchObject({ outcome: { kind: 'upcoming' }, locked: false });
    expect(board.shredded.map((e) => e.bet.id)).toEqual(['d']);
    // the shredded week-4 bet was ruled on too — it must not count
    expect(board.record.map((r) => [r.ownerId, r.won.length, r.lost.length])).toEqual([
      ['ua', 1, 0],
      ['ub', 0, 1],
    ]);
  });
});

describe('lastScoredWeek', () => {
  it('finds the latest week with points on the board', () => {
    expect(lastScoredWeek(undefined)).toBe(0);
    expect(
      lastScoredWeek({
        1: [{ m: 1, r: 1, p: 100 }],
        2: [{ m: 1, r: 1, p: -1 }], // negative still counts
        3: [{ m: 1, r: 1, p: 0 }], // scheduled, not started
      }),
    ).toBe(2);
  });
});
