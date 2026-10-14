import { describe, expect, it } from 'vitest';
import { touchesTerms, validateDraft, validatePatch, validateWho } from './validate';

const draft = {
  season: '2025',
  week: 6,
  sideA: 'ua',
  sideB: 'ub',
  stakes: '  a keg  ',
  terms: { kind: 'matchup' },
};

describe('validateDraft', () => {
  it('accepts and trims a good bet; coerces a numeric season', () => {
    expect(validateDraft(draft)).toEqual({ ok: true, value: { ...draft, stakes: 'a keg' } });
    expect(validateDraft({ ...draft, season: 2025 })).toMatchObject({ ok: true, value: { season: '2025' } });
  });
  it('rejects self-bets, bad weeks, empty or long stakes, empty custom terms', () => {
    expect(validateDraft({ ...draft, sideB: 'ua' }).ok).toBe(false);
    expect(validateDraft({ ...draft, week: 0 }).ok).toBe(false);
    expect(validateDraft({ ...draft, week: 18 }).ok).toBe(false);
    expect(validateDraft({ ...draft, week: 2.5 }).ok).toBe(false);
    expect(validateDraft({ ...draft, stakes: '   ' }).ok).toBe(false);
    expect(validateDraft({ ...draft, stakes: 'x'.repeat(121) }).ok).toBe(false);
    expect(validateDraft({ ...draft, terms: { kind: 'custom', text: ' ' } }).ok).toBe(false);
    expect(validateDraft({ ...draft, terms: { kind: 'parlay' } }).ok).toBe(false);
    expect(validateDraft({ ...draft, season: 'last year' }).ok).toBe(false);
  });
  it('drops extra fields on custom terms', () => {
    expect(validateDraft({ ...draft, terms: { kind: 'custom', text: 'x', evil: 1 } })).toMatchObject({
      ok: true,
      value: { terms: { kind: 'custom', text: 'x' } },
    });
  });
});

describe('validatePatch', () => {
  it('keeps only known keys and validates each', () => {
    expect(validatePatch({ paid: true, hack: 1 })).toEqual({ ok: true, value: { paid: true } });
    expect(validatePatch({ winner: null })).toEqual({ ok: true, value: { winner: null } });
    expect(validatePatch({ winner: 'C' }).ok).toBe(false);
    expect(validatePatch({ deleted: 'yes' }).ok).toBe(false);
    expect(validatePatch({}).ok).toBe(false);
    expect(validatePatch({ sideA: '' }).ok).toBe(false);
  });
  it('knows which patches rewrite the wager', () => {
    expect(touchesTerms({ stakes: 'two kegs' })).toBe(true);
    expect(touchesTerms({ paid: true, winner: 'A', deleted: true })).toBe(false);
  });
});

describe('validateWho', () => {
  it('requires a name', () => {
    expect(validateWho('  ').ok).toBe(false);
    expect(validateWho(' Keeneng ')).toEqual({ ok: true, value: 'Keeneng' });
  });
});
