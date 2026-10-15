import { describe, expect, it } from 'vitest';
import { touchesTerms, validateDraft, validatePatch } from './validate';

const draft = {
  season: '2025',
  week: 6,
  sideA: 'ua',
  sideB: 'ub',
  terms: '  If ua loses to ub in Week 6, ua owes ub a keg.  ',
};

describe('validateDraft', () => {
  it('accepts and trims a good bet; coerces a numeric season', () => {
    expect(validateDraft(draft)).toEqual({ ok: true, value: { ...draft, terms: draft.terms.trim() } });
    expect(validateDraft({ ...draft, season: 2025 })).toMatchObject({ ok: true, value: { season: '2025' } });
  });
  it('rejects self-bets, bad weeks, and empty or overlong terms', () => {
    expect(validateDraft({ ...draft, sideB: 'ua' }).ok).toBe(false);
    expect(validateDraft({ ...draft, week: 0 }).ok).toBe(false);
    expect(validateDraft({ ...draft, week: 18 }).ok).toBe(false);
    expect(validateDraft({ ...draft, week: 2.5 }).ok).toBe(false);
    expect(validateDraft({ ...draft, terms: '   ' }).ok).toBe(false);
    expect(validateDraft({ ...draft, terms: 'x'.repeat(401) }).ok).toBe(false);
    expect(validateDraft({ ...draft, season: 'last year' }).ok).toBe(false);
  });
});

describe('validatePatch', () => {
  it('keeps only known keys and validates each', () => {
    expect(validatePatch({ winner: 'A', hack: 1, paidTo: 'A' })).toEqual({ ok: true, value: { winner: 'A' } });
    expect(validatePatch({ winner: null })).toEqual({ ok: true, value: { winner: null } });
    expect(validatePatch({ winner: 'C' }).ok).toBe(false);
    expect(validatePatch({ deleted: 'yes' }).ok).toBe(false);
    expect(validatePatch({}).ok).toBe(false);
    expect(validatePatch({ sideA: '' }).ok).toBe(false);
    expect(validatePatch({ terms: ' ' }).ok).toBe(false);
  });
  it('knows which patches rewrite the wager', () => {
    expect(touchesTerms({ terms: 'two kegs' })).toBe(true);
    expect(touchesTerms({ winner: 'A', deleted: true })).toBe(false);
  });
});
