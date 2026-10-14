import type { BetDraft, BetPatch, BetSide, BetTerms } from '../model/types';

/** Shared by the form (to disable submit) and the bets function (to reject),
    so the two can't disagree about what a valid bet is. */
export const BET_LIMITS = { stakes: 120, terms: 280, who: 50 } as const;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function terms(v: unknown): Result<BetTerms> {
  if (!isObj(v)) return { ok: false, error: 'terms are required' };
  if (v.kind === 'matchup') return { ok: true, value: { kind: 'matchup' } };
  if (v.kind === 'custom') {
    const text = str(v.text);
    if (!text) return { ok: false, error: 'custom bets need terms' };
    if (text.length > BET_LIMITS.terms) return { ok: false, error: `terms must be ≤ ${BET_LIMITS.terms} chars` };
    return { ok: true, value: { kind: 'custom', text } };
  }
  return { ok: false, error: 'unknown bet kind' };
}

function week(v: unknown): Result<number> {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 17
    ? { ok: true, value: v }
    : { ok: false, error: 'week must be 1–17' };
}

function stakes(v: unknown): Result<string> {
  const s = str(v);
  if (!s) return { ok: false, error: 'stakes are required' };
  if (s.length > BET_LIMITS.stakes) return { ok: false, error: `stakes must be ≤ ${BET_LIMITS.stakes} chars` };
  return { ok: true, value: s };
}

/** The acting manager's name. Unverified (the PIN is shared), but recorded. */
export function validateWho(v: unknown): Result<string> {
  const s = str(v);
  if (!s) return { ok: false, error: 'who are you?' };
  if (s.length > BET_LIMITS.who) return { ok: false, error: `name must be ≤ ${BET_LIMITS.who} chars` };
  return { ok: true, value: s };
}

export function validateDraft(v: unknown): Result<BetDraft> {
  if (!isObj(v)) return { ok: false, error: 'bet is required' };
  const season = typeof v.season === 'number' ? String(v.season) : str(v.season);
  if (!/^\d{4}$/.test(season)) return { ok: false, error: 'season must be a year' };
  const w = week(v.week);
  if (!w.ok) return w;
  const sideA = str(v.sideA);
  const sideB = str(v.sideB);
  if (!sideA || !sideB) return { ok: false, error: 'pick both sides' };
  if (sideA === sideB) return { ok: false, error: "you can't bet against yourself" };
  const s = stakes(v.stakes);
  if (!s.ok) return s;
  const t = terms(v.terms);
  if (!t.ok) return t;
  return { ok: true, value: { season, week: w.value, sideA, sideB, stakes: s.value, terms: t.value } };
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
      if (!s) return { ok: false, error: 'pick both sides' };
      out[k] = s;
    }
  }
  if ('stakes' in v) {
    const s = stakes(v.stakes);
    if (!s.ok) return s;
    out.stakes = s.value;
  }
  if ('terms' in v) {
    const t = terms(v.terms);
    if (!t.ok) return t;
    out.terms = t.value;
  }
  for (const k of ['winner', 'paidTo'] as const) {
    if (k in v) {
      if (v[k] !== null && v[k] !== 'A' && v[k] !== 'B') return { ok: false, error: `${k} must be A, B or null` };
      out[k] = v[k] as BetSide | null;
    }
  }
  if ('deleted' in v) {
    if (typeof v.deleted !== 'boolean') return { ok: false, error: 'deleted must be true or false' };
    out.deleted = v.deleted;
  }
  if (Object.keys(out).length === 0) return { ok: false, error: 'nothing to change' };
  return { ok: true, value: out };
}

/** Fields that define the wager itself. Once a bet is locked these are frozen;
    settling up (`winner`, `paidTo`) and the tombstone stay editable. */
export const TERM_FIELDS = ['week', 'sideA', 'sideB', 'stakes', 'terms'] as const;

export function touchesTerms(p: BetPatch): boolean {
  return TERM_FIELDS.some((k) => k in p);
}
