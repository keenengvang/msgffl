import { describe, expect, it } from 'vitest';
import type { BetRecord } from '@/entities/bet/model/types';
import { diff, fromBet, placeholderBet, rebaseForm } from './betForm';

const rec = (over: Partial<BetRecord> = {}): BetRecord => ({
  id: 'x',
  season: '2025',
  week: 6,
  sideA: 'ua',
  sideB: 'ub',
  rosterA: null,
  rosterB: null,
  terms: 'If ua loses, ua owes ub a keg.',
  winner: null,
  paidAt: null,
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
  version: 'v1',
  ...over,
});

describe('rebaseForm', () => {
  it("keeps this user's edits and takes the other editor's changes", () => {
    const base = rec();
    const fresh = rec({ sideB: 'uc', version: 'v2' }); // someone else swapped Team B
    const mine = { ...fromBet(base), terms: 'two kegs' }; // I only touched the terms
    const rebased = rebaseForm(mine, base, fresh);
    expect(rebased).toMatchObject({ sideB: 'uc', terms: 'two kegs' });
    // and the retry's patch carries only my change
    expect(diff(fresh, { season: '2025', ...rebased })).toEqual({ terms: 'two kegs' });
  });

  it('my edit wins on a field we both changed', () => {
    const base = rec();
    const fresh = rec({ terms: 'a High Noon', version: 'v2' });
    expect(rebaseForm({ ...fromBet(base), terms: 'two kegs' }, base, fresh).terms).toBe('two kegs');
  });

  it('whitespace-only terms changes are not an edit', () => {
    const base = rec();
    const fresh = rec({ terms: 'two kegs', version: 'v2' });
    expect(rebaseForm({ ...fromBet(base), terms: ` ${base.terms}  ` }, base, fresh).terms).toBe('two kegs');
  });
});

describe('placeholderBet', () => {
  it('fills in the teams and week, and rotates through examples', () => {
    const p = placeholderBet(0, true, 'Mike', 'Dave', 7);
    expect(p).toContain('Mike');
    expect(p).toContain('Dave');
    expect(p).toContain('Week 7');
    expect(p).not.toMatch(/\{[ABW]\}/);
    expect(placeholderBet(1, true, 'A', 'B', 1)).not.toBe(placeholderBet(0, true, 'A', 'B', 1));
    expect(placeholderBet(0, false, 'A', 'B', 1)).not.toBe(placeholderBet(0, true, 'A', 'B', 1));
  });
});
