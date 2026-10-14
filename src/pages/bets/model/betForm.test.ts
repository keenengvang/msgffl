import { describe, expect, it } from 'vitest';
import type { BetRecord } from '@/entities/bet/model/types';
import { diff, fromBet, rebaseForm } from './betForm';

const rec = (over: Partial<BetRecord> = {}): BetRecord => ({
  id: 'x',
  season: '2025',
  week: 6,
  sideA: 'ua',
  sideB: 'ub',
  stakes: 'a keg',
  terms: { kind: 'matchup' },
  winner: null,
  createdBy: 'k',
  createdAt: '',
  updatedBy: 'k',
  updatedAt: '',
  deletedAt: null,
  deletedBy: null,
  version: 'v1',
  ...over,
});

describe('rebaseForm', () => {
  it("keeps this user's edits and takes the other editor's changes", () => {
    const base = rec();
    const fresh = rec({ sideB: 'uc', version: 'v2' }); // someone else swapped side B
    const mine = { ...fromBet(base), stakes: 'two kegs' }; // I only touched stakes
    const rebased = rebaseForm(mine, base, fresh);
    expect(rebased).toMatchObject({ sideB: 'uc', stakes: 'two kegs' });
    // and the retry's patch carries only my change
    expect(diff(fresh, { season: '2025', ...rebased, terms: { kind: 'matchup' } })).toEqual({ stakes: 'two kegs' });
  });

  it('my edit wins on a field we both changed', () => {
    const base = rec();
    const fresh = rec({ stakes: 'a High Noon', version: 'v2' });
    expect(rebaseForm({ ...fromBet(base), stakes: 'two kegs' }, base, fresh).stakes).toBe('two kegs');
  });

  it('custom text abandoned by switching back to HIGHER SCORE is not an edit', () => {
    const base = rec(); // matchup
    const fresh = rec({ terms: { kind: 'custom', text: 'first to bench a 0' }, version: 'v2' });
    const mine = { ...fromBet(base), kind: 'matchup' as const, text: 'typed then abandoned' };
    expect(rebaseForm(mine, base, fresh)).toMatchObject({ kind: 'custom', text: 'first to bench a 0' });
  });

  it('whitespace-only stakes changes are not an edit', () => {
    const base = rec();
    const fresh = rec({ stakes: 'two kegs', version: 'v2' });
    expect(rebaseForm({ ...fromBet(base), stakes: ' a keg  ' }, base, fresh).stakes).toBe('two kegs');
  });

  it('moves kind and text together', () => {
    const base = rec();
    const fresh = rec({ terms: { kind: 'custom', text: 'first to bench a 0' }, version: 'v2' });
    expect(rebaseForm(fromBet(base), base, fresh)).toMatchObject({ kind: 'custom', text: 'first to bench a 0' });
  });
});
