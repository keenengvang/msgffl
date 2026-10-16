import { describe, expect, it } from 'vitest';
import type { Bet } from '../model/types';
import { betRecord, isComplete, isOwed, resolveBet, sideScores, weekIsFinal } from './resolveBet';

const bet = (over: Partial<Bet> = {}): Bet => ({
  id: 'x',
  season: '2025',
  week: 5,
  sideA: 'ua',
  sideB: 'ub',
  rosterA: null,
  rosterB: null,
  terms: 'If ua loses to ub in Week 5, ua owes ub a keg.',
  winner: null,
  paidAt: null,
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
  ...over,
});

describe('sideScores', () => {
  const rosterOf = { ua: 1, ub: 2, uc: 3 };
  it('maps owners → rosters → that week’s points, null when absent', () => {
    const rows = [
      { m: 1, r: 1, p: 101.5 },
      { m: 2, r: 2, p: 0 },
    ];
    expect(sideScores(bet(), rows, rosterOf)).toEqual({ a: 101.5, b: 0 });
    expect(sideScores(bet({ sideB: 'uc' }), rows, rosterOf)).toEqual({ a: 101.5, b: null });
    expect(sideScores(bet({ sideA: 'ghost' }), rows, rosterOf).a).toBeNull();
    expect(sideScores(bet(), undefined, rosterOf)).toEqual({ a: null, b: null });
  });
  it('prefers the roster recorded on the bet (a team that changed owners still scores)', () => {
    const rows = [
      { m: 1, r: 1, p: 90 },
      { m: 1, r: 7, p: 120 },
    ];
    // ua's roster 7 now belongs to someone else; the bet recorded it
    expect(sideScores(bet({ rosterA: 7 }), rows, { ub: 1 })).toEqual({ a: 120, b: 90 });
  });
});

describe('weekIsFinal', () => {
  const base = { status: 'in_season', season: '2025', nflSeason: '2025', nflWeek: 6 };
  it('is final once the NFL week has moved past it', () => {
    expect(weekIsFinal(base, 5)).toBe(true);
    expect(weekIsFinal(base, 6)).toBe(false);
    expect(weekIsFinal(base, 7)).toBe(false);
  });
  it('a complete or earlier season is always final', () => {
    expect(weekIsFinal({ ...base, status: 'complete' }, 17)).toBe(true);
    expect(weekIsFinal({ ...base, season: '2024' }, 17)).toBe(true);
  });
  it('unknown NFL state is never final', () => {
    expect(weekIsFinal({ ...base, nflSeason: undefined, nflWeek: undefined }, 1)).toBe(false);
  });
});

describe('resolveBet', () => {
  it('pending until someone rules: upcoming, then live, then asks for a ruling', () => {
    expect(resolveBet(bet(), { a: 0, b: 0 }, false)).toEqual({ kind: 'upcoming' });
    expect(resolveBet(bet(), { a: 30, b: 10 }, false)).toEqual({ kind: 'live' });
    expect(resolveBet(bet(), { a: -1, b: 0 }, false)).toEqual({ kind: 'live' }); // a missed PAT counts as started
    expect(resolveBet(bet(), { a: 130, b: 10 }, true)).toEqual({ kind: 'ruling' });
  });
  it('a ruling settles it — even before the week is over', () => {
    expect(resolveBet(bet({ winner: 'B' }), { a: 130, b: 10 }, true)).toEqual({ kind: 'settled', winner: 'B', paid: false });
    expect(resolveBet(bet({ winner: 'A' }), { a: 0, b: 0 }, false)).toEqual({ kind: 'settled', winner: 'A', paid: false });
  });
});

describe('isComplete / isOwed / betRecord', () => {
  it('complete means ruled AND paid; ruled but unpaid is owed', () => {
    expect(isComplete({ kind: 'settled', winner: 'A', paid: true })).toBe(true);
    expect(isComplete({ kind: 'settled', winner: 'A', paid: false })).toBe(false);
    expect(isOwed({ kind: 'settled', winner: 'A', paid: false })).toBe(true);
    expect(isOwed({ kind: 'settled', winner: 'A', paid: true })).toBe(false);
    for (const kind of ['upcoming', 'live', 'ruling'] as const) {
      expect(isComplete({ kind })).toBe(false);
      expect(isOwed({ kind })).toBe(false);
    }
  });

  it('a ruled bet carries whether it was paid', () => {
    expect(resolveBet(bet({ winner: 'A', paidAt: '2025-10-20' }), { a: 0, b: 0 }, true)).toEqual({ kind: 'settled', winner: 'A', paid: true });
    expect(resolveBet(bet({ winner: 'B' }), { a: 0, b: 0 }, true)).toEqual({ kind: 'settled', winner: 'B', paid: false });
  });

  it('tallies bets won, lost, open and owed per manager, best bettor first', () => {
    const won = (winner: 'A' | 'B', paid = true) => ({ kind: 'settled', winner, paid }) as const;
    const entries = [
      { bet: bet({ id: '1', sideA: 'ua', sideB: 'ub' }), outcome: won('A', false) }, // ua beats ub — ub hasn't paid
      { bet: bet({ id: '2', sideA: 'uc', sideB: 'ub' }), outcome: won('A') }, // uc beats ub
      { bet: bet({ id: '3', sideA: 'ua', sideB: 'uc' }), outcome: won('B') }, // uc beats ua
      { bet: bet({ id: '5', deletedAt: 'now' }), outcome: won('A') }, // deleted → ignored
      { bet: bet({ id: '7' }), outcome: { kind: 'upcoming' } as const }, // pending → open for both
      { bet: bet({ id: '8', sideA: 'ud', sideB: 'ua' }), outcome: { kind: 'ruling' } as const }, // week over, unruled → still open
    ];
    expect(betRecord(entries).map((r) => [r.ownerId, r.won.length, r.lost.length, r.open.length, r.owes.length])).toEqual([
      ['uc', 2, 0, 0, 0],
      ['ua', 1, 1, 2, 0],
      ['ud', 0, 0, 1, 0], // only an open bet — still gets a row
      ['ub', 0, 2, 1, 1], // lost two, paid one
    ]);
  });
});
