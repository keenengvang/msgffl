import { describe, expect, it } from 'vitest';
import type { BetRecord } from '@/entities/bet/model/types';
import { buildBoard } from './board';

const bet = (id: string, week: number, over: Partial<BetRecord> = {}): BetRecord => ({
  id,
  season: '2025',
  week,
  sideA: 'ua',
  sideB: 'ub',
  stakes: 'a keg',
  terms: { kind: 'matchup' },
  winner: null,
  paid: false,
  createdBy: 'k',
  createdAt: '',
  updatedBy: 'k',
  updatedAt: '',
  deletedAt: null,
  deletedBy: null,
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
    const board = buildBoard([bet('a', 4), bet('b', 5), bet('c', 6), bet('d', 4, { deletedAt: 'x' })], ctx);
    expect(board.weeks.map((w) => [w.week, w.entries.map((e) => e.bet.id)])).toEqual([
      [6, ['c']],
      [5, ['b']],
      [4, ['a']],
    ]);
    const [w6, w5, w4] = board.weeks;
    expect(w4!.entries[0]).toMatchObject({ outcome: { kind: 'settled', winner: 'A' }, locked: true });
    expect(w5!.entries[0]).toMatchObject({ outcome: { kind: 'live', leader: 'A' }, locked: true });
    expect(w6!.entries[0]).toMatchObject({ outcome: { kind: 'upcoming' }, locked: false });
    expect(board.shredded.map((e) => e.bet.id)).toEqual(['d']);
    // the deleted week-4 bet would also have settled — it must not hit the tab
    expect(board.tab.map((r) => [r.ownerId, r.owes.length, r.owed.length])).toEqual([
      ['ub', 1, 0],
      ['ua', 0, 1],
    ]);
  });
});
