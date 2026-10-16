import { describe, expect, it } from 'vitest';
import type { BetRecord } from '@/entities/bet/model/types';
import { buildBoard, filterBoard, lastScoredWeek, sortRecord, winPct } from './board';

const bet = (id: string, week: number, over: Partial<BetRecord> = {}): BetRecord => ({
  createdAt: '',
  id,
  season: '2025',
  week,
  sideA: 'ua',
  sideB: 'ub',
  rosterA: null,
  rosterB: null,
  terms: 'a keg',
  winner: null,
  paidAt: null,
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

  const board = buildBoard(
    [
      bet('a', 4, { winner: 'A', paidAt: '2025-10-03', createdAt: '2025-10-01' }),
      bet('f', 4, { winner: 'B', createdAt: '2025-09-30' }), // ub won, ua hasn't paid
      bet('e', 4, { createdAt: '2025-10-02', sideB: 'uc' }),
      bet('b', 5),
      bet('c', 6),
      bet('d', 4, { winner: 'A', deletedAt: 'x' }),
    ],
    ctx,
  );

  it('lists live bets in one run — newest week first, newest booked first within it — settled and tallied', () => {
    expect(board.bets.map((e) => e.bet.id)).toEqual(['c', 'b', 'e', 'a', 'f']);
    const [c, b, e, a, f] = board.bets;
    expect(a).toMatchObject({ outcome: { kind: 'settled', winner: 'A', paid: true } });
    expect(f).toMatchObject({ outcome: { kind: 'settled', winner: 'B', paid: false } });
    expect(e).toMatchObject({ outcome: { kind: 'ruling' } }); // week over, nobody ruled
    expect(b).toMatchObject({ outcome: { kind: 'live' } });
    expect(c).toMatchObject({ outcome: { kind: 'upcoming' } });
    expect(board.bets.some((x) => x.bet.id === 'd')).toBe(false); // deleted bets never reach the board
    // the deleted week-4 bet was ruled on too — it must not count
    expect(board.record.map((r) => [r.ownerId, r.won.length, r.lost.length, r.open.length, r.owes.length])).toEqual([
      ['ua', 1, 1, 3, 1], // lost f and hasn't paid (tied with ub on W–L → id order)
      ['ub', 1, 1, 2, 0],
      ['uc', 0, 0, 1, 0],
    ]);
  });

  it('filters by status and by manager', () => {
    const ids = (f: Parameters<typeof filterBoard>[1], who: string | null = null) =>
      filterBoard(board.bets, f, who).map((e) => e.bet.id);
    expect(ids('all')).toEqual(['c', 'b', 'e', 'a', 'f']);
    expect(ids('pending')).toEqual(['c', 'b', 'e']); // week over but unruled is still pending
    expect(ids('unpaid')).toEqual(['f']); // ruled, loser hasn't paid
    expect(ids('paid')).toEqual(['a']);
    expect(ids('all', 'uc')).toEqual(['e']);
    expect(ids('pending', 'ub')).toEqual(['c', 'b']);
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

describe('sortRecord', () => {
  const row = (ownerId: string, won: number, lost: number, open = 0) => ({
    ownerId,
    won: Array.from({ length: won }, (_, i) => bet(`w${i}`, 1)),
    lost: Array.from({ length: lost }, (_, i) => bet(`l${i}`, 1)),
    open: Array.from({ length: open }, (_, i) => bet(`o${i}`, 1)),
    owes: Array.from({ length: Math.min(lost, 1) }, (_, i) => bet(`d${i}`, 1)),
  });
  const names: Record<string, string> = { a: 'Zed', b: 'amy', c: 'Bo', d: 'Cy' };
  const rows = [row('a', 3, 1), row('b', 1, 0, 2), row('c', 0, 0, 4), row('d', 3, 3)];
  const order = (key: Parameters<typeof sortRecord>[1]['key'], dir: 'asc' | 'desc') =>
    sortRecord(rows, { key, dir }, (id) => names[id]!).map((r) => names[r.ownerId]);

  it('sorts by any column, ties broken by wins then fewest losses', () => {
    expect(order('won', 'desc')).toEqual(['Zed', 'Cy', 'amy', 'Bo']);
    expect(order('name', 'asc')).toEqual(['amy', 'Bo', 'Cy', 'Zed']); // case-insensitive
    expect(order('open', 'desc')).toEqual(['Bo', 'amy', 'Zed', 'Cy']);
    expect(order('lost', 'asc')).toEqual(['amy', 'Bo', 'Zed', 'Cy']);
    expect(order('owes', 'desc')).toEqual(['Zed', 'Cy', 'amy', 'Bo']); // Zed & Cy owe one each
  });

  it('win% — undecided (0-0) sinks to the bottom either way', () => {
    expect(winPct(rows[2]!)).toBeNull();
    expect(order('pct', 'desc')).toEqual(['amy', 'Zed', 'Cy', 'Bo']);
    expect(order('pct', 'asc')).toEqual(['Cy', 'Zed', 'amy', 'Bo']);
  });
});
