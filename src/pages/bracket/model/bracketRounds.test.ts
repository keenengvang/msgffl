import { describe, expect, it } from 'vitest';
import type { BracketGame } from '@/shared/api/types';
import type { StandingRow } from '@/entities/team/model/types';
import { bracketRounds } from './bracketRounds';

const row = (rosterId: number, w = 8): StandingRow => ({
  rosterId,
  ownerId: `o${rosterId}`,
  team: `T${rosterId}`,
  owner: `o${rosterId}`,
  avatar: '',
  w,
  l: 14 - w,
  t: 0,
  pf: 1400,
  pa: 1300,
  recordStr: '',
});

const names = Object.fromEntries([1, 2, 3, 4].map((i) => [i, row(i)]));

describe('bracketRounds', () => {
  const winners: BracketGame[] = [
    { r: 1, m: 1, t1: 1, t2: 2, w: 1, l: 2 },
    { r: 1, m: 2, t1: 3, t2: 4, w: 3, l: 4 },
    { r: 2, m: 3, p: 1, t1: 1, t2: 3, w: 1, l: 3 },
    { r: 2, m: 4, p: 3, t1: 2, t2: 4, w: null, l: null, t1_from: { l: 1 }, t2_from: { l: 2 } },
  ];

  it('titles rounds and orders games by placing', () => {
    const rounds = bracketRounds(winners, names);
    expect(rounds.map((r) => r.title)).toEqual(['SEMIFINALS', 'CHAMPIONSHIP']);
    // title game (p=1) sorts before bronze (p=3)
    expect(rounds[1]!.games[0]!.isTitle).toBe(true);
  });

  it('marks winners with W and the title-game label names the champion', () => {
    const rounds = bracketRounds(winners, names);
    const title = rounds[1]!.games[0]!;
    expect(title.a).toMatchObject({ name: 'T1', tag: 'W', win: true });
    expect(title.b).toMatchObject({ name: 'T3', win: false, tag: '8–6' });
    expect(title.label).toBe('★ TITLE GAME — T1 TAKES THE BELT');
    expect(rounds[1]!.games[1]!.label).toBe('BRONZE — NOBODY BRAGS ABOUT THIS');
  });

  it('resolves undecided slots to TBD / WINNER-LOSER G#', () => {
    const pending: BracketGame[] = [{ r: 1, m: 9, t1: null, t2: null, t1_from: { w: 5 }, t2_from: {} }];
    const rounds = bracketRounds(pending, names);
    expect(rounds[0]!.games[0]!.a.name).toBe('WINNER G5');
    expect(rounds[0]!.games[0]!.b.name).toBe('TBD');
  });
});
