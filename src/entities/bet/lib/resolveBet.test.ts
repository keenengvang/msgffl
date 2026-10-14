import { describe, expect, it } from 'vitest';
import type { Bet } from '../model/types';
import { betRecord, isComplete, isLocked, resolveBet, sideScores, weekIsFinal } from './resolveBet';

const bet = (over: Partial<Bet> = {}): Bet => ({
  id: 'x',
  season: '2025',
  week: 5,
  sideA: 'ua',
  sideB: 'ub',
  rosterA: null,
  rosterB: null,
  stakes: 'a keg',
  terms: { kind: 'matchup' },
  winner: null,
  createdBy: 'a',
  createdAt: '',
  updatedBy: 'a',
  updatedAt: '',
  deletedAt: null,
  deletedBy: null,
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

describe('isLocked', () => {
  it('locks when either side has scored, or the week is over', () => {
    expect(isLocked({ a: 0, b: 0 }, false)).toBe(false);
    expect(isLocked({ a: null, b: null }, false)).toBe(false);
    expect(isLocked({ a: 0, b: 3.2 }, false)).toBe(true);
    expect(isLocked({ a: 0, b: 0 }, true)).toBe(true);
  });
  it('a negative total has started too (missed PAT on Thursday)', () => {
    expect(isLocked({ a: -1, b: 0 }, false)).toBe(true);
  });
});

describe('resolveBet — matchup', () => {
  it('upcoming before anyone scores, live with a leader mid-week', () => {
    expect(resolveBet(bet(), { a: 0, b: 0 }, false)).toEqual({ kind: 'upcoming' });
    expect(resolveBet(bet(), { a: 50, b: 61 }, false)).toEqual({ kind: 'live', a: 50, b: 61, leader: 'B' });
    expect(resolveBet(bet(), { a: 20, b: 20 }, false)).toMatchObject({ kind: 'live', leader: null });
  });
  it('settles on the higher score once final', () => {
    expect(resolveBet(bet(), { a: 120.4, b: 99 }, true)).toEqual({ kind: 'settled', winner: 'A' });
    expect(resolveBet(bet(), { a: 80, b: 99 }, true)).toEqual({ kind: 'settled', winner: 'B' });
  });
  it('an exact tie is a push', () => {
    expect(resolveBet(bet(), { a: 100, b: 100 }, true)).toEqual({ kind: 'push', a: 100, b: 100 });
  });
  it('never settles on missing or all-zero scores', () => {
    expect(resolveBet(bet(), { a: 100, b: null }, true)).toEqual({ kind: 'unknown' });
    expect(resolveBet(bet(), { a: 0, b: 0 }, true)).toEqual({ kind: 'unknown' });
  });
  it('settles and goes live on negative totals', () => {
    expect(resolveBet(bet(), { a: -2, b: 0 }, true)).toEqual({ kind: 'settled', winner: 'B' });
    expect(resolveBet(bet(), { a: -1, b: 0 }, false)).toEqual({ kind: 'live', a: -1, b: 0, leader: 'B' });
  });
  it('ignores a stored winner — the scores decide', () => {
    expect(resolveBet(bet({ winner: 'B' }), { a: 120, b: 99 }, true)).toEqual({ kind: 'settled', winner: 'A' });
  });
});

describe('resolveBet — custom', () => {
  const custom = (over: Partial<Bet> = {}) => bet({ terms: { kind: 'custom', text: 'first to bench a 0' }, ...over });
  it('settles only on a ruling, and asks for one after the week', () => {
    expect(resolveBet(custom(), { a: 0, b: 0 }, false)).toEqual({ kind: 'upcoming' });
    expect(resolveBet(custom(), { a: 30, b: 10 }, false)).toEqual({ kind: 'live', a: 30, b: 10, leader: null });
    expect(resolveBet(custom(), { a: 130, b: 10 }, true)).toEqual({ kind: 'ruling' });
    expect(resolveBet(custom({ winner: 'B' }), { a: 130, b: 10 }, true)).toEqual({ kind: 'settled', winner: 'B' });
    // a ruling can land before the week ends ("he already benched a 0")
    expect(resolveBet(custom({ winner: 'A' }), { a: 0, b: 0 }, false)).toEqual({ kind: 'settled', winner: 'A' });
  });
});

describe('isComplete / betRecord', () => {
  it('only a decided bet or a push is complete', () => {
    expect(isComplete({ kind: 'settled', winner: 'A' })).toBe(true);
    expect(isComplete({ kind: 'push', a: 1, b: 1 })).toBe(true);
    for (const kind of ['upcoming', 'ruling', 'unknown'] as const) expect(isComplete({ kind })).toBe(false);
    expect(isComplete({ kind: 'live', a: 1, b: 0, leader: 'A' })).toBe(false);
  });

  it('tallies settled bets won and lost per manager, best bettor first', () => {
    const won = (winner: 'A' | 'B') => ({ kind: 'settled', winner }) as const;
    const entries = [
      { bet: bet({ id: '1', sideA: 'ua', sideB: 'ub' }), outcome: won('A') }, // ua beats ub
      { bet: bet({ id: '2', sideA: 'uc', sideB: 'ub' }), outcome: won('A') }, // uc beats ub
      { bet: bet({ id: '3', sideA: 'ua', sideB: 'uc' }), outcome: won('B') }, // uc beats ua
      { bet: bet({ id: '5', deletedAt: 'now' }), outcome: won('A') }, // shredded → ignored
      { bet: bet({ id: '6' }), outcome: { kind: 'push', a: 1, b: 1 } as const }, // push → no W/L
      { bet: bet({ id: '7' }), outcome: { kind: 'upcoming' } as const }, // pending → ignored
    ];
    expect(betRecord(entries).map((r) => [r.ownerId, r.won.length, r.lost.length])).toEqual([
      ['uc', 2, 0],
      ['ua', 1, 1],
      ['ub', 0, 2],
    ]);
  });
});
