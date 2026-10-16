import type { BetDraft, BetPatch, BetSide } from '../model/types';

/** Shared by the form (to disable submit) and the bets function (to reject),
    so the two can't disagree about what a valid bet is. */
export const BET_LIMITS = { terms: 400 } as const;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function terms(v: unknown): Result<string> {
  const s = str(v);
  if (!s) return { ok: false, error: 'spell out the bet' };
  if (s.length > BET_LIMITS.terms) return { ok: false, error: `keep it under ${BET_LIMITS.terms} characters` };
  return { ok: true, value: s };
}

function week(v: unknown): Result<number> {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 17
    ? { ok: true, value: v }
    : { ok: false, error: 'week must be 1–17' };
}

export function validateDraft(v: unknown): Result<BetDraft> {
  if (!isObj(v)) return { ok: false, error: 'bet is required' };
  const season = typeof v.season === 'number' ? String(v.season) : str(v.season);
  if (!/^\d{4}$/.test(season)) return { ok: false, error: 'season must be a year' };
  const w = week(v.week);
  if (!w.ok) return w;
  const sideA = str(v.sideA);
  const sideB = str(v.sideB);
  if (!sideA || !sideB) return { ok: false, error: 'pick both teams' };
  if (sideA === sideB) return { ok: false, error: "a team can't bet against itself" };
  const t = terms(v.terms);
  if (!t.ok) return t;
  return { ok: true, value: { season, week: w.value, sideA, sideB, terms: t.value } };
}

/** Only the keys present are checked; unknown keys are dropped. */
export function validatePatch(v: unknown): Result<BetPatch> {
  if (!isObj(v)) return { ok: false, error: 'patch is required' };
  const out: BetPatch = {};
  if ('week' in v) {
    const w = week(v.week);
    if (!w.ok) return w;
    out.week = w.value;
  }
  for (const k of ['sideA', 'sideB'] as const) {
    if (k in v) {
      const s = str(v[k]);
      if (!s) return { ok: false, error: 'pick both teams' };
      out[k] = s;
    }
  }
  if ('terms' in v) {
    const t = terms(v.terms);
    if (!t.ok) return t;
    out.terms = t.value;
  }
  if ('winner' in v) {
    if (v.winner !== null && v.winner !== 'A' && v.winner !== 'B') return { ok: false, error: 'winner must be A, B or null' };
    out.winner = v.winner as BetSide | null;
  }
  if ('paid' in v) {
    if (typeof v.paid !== 'boolean') return { ok: false, error: 'paid must be true or false' };
    out.paid = v.paid;
  }
  if ('deleted' in v) {
    if (typeof v.deleted !== 'boolean') return { ok: false, error: 'deleted must be true or false' };
    out.deleted = v.deleted;
  }
  if (Object.keys(out).length === 0) return { ok: false, error: 'nothing to change' };
  return { ok: true, value: out };
}

/** Fields that define the wager itself. Rewriting any of them clears a
    ruling and its payout, and they can't be rewritten in the same patch as
    either. */
export const TERM_FIELDS = ['week', 'sideA', 'sideB', 'terms'] as const;

export function touchesTerms(p: BetPatch): boolean {
  return TERM_FIELDS.some((k) => k in p);
}
