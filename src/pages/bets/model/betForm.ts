import type { BetDraft, BetPatch, BetRecord, BetTerms } from '@/entities/bet/model/types';

/** The bet form's local fields. */
export interface FormState {
  sideA: string;
  sideB: string;
  week: number;
  kind: BetTerms['kind'];
  text: string;
  stakes: string;
}

export const fromBet = (b: BetRecord): FormState => ({
  sideA: b.sideA,
  sideB: b.sideB,
  week: b.week,
  kind: b.terms.kind,
  text: b.terms.kind === 'custom' ? b.terms.text : '',
  stakes: b.stakes,
});

/** Only what changed — an edit that doesn't touch the wager shouldn't trip the kickoff lock. */
export function diff(before: BetRecord, d: BetDraft): BetPatch {
  const p: BetPatch = {};
  if (d.week !== before.week) p.week = d.week;
  if (d.sideA !== before.sideA) p.sideA = d.sideA;
  if (d.sideB !== before.sideB) p.sideB = d.sideB;
  if (d.stakes !== before.stakes) p.stakes = d.stakes;
  if (JSON.stringify(d.terms) !== JSON.stringify(before.terms)) p.terms = d.terms;
  return p;
}

/** Field groups that move together (kind + text are one "terms" edit). */
const GROUPS: Array<Array<keyof FormState>> = [['sideA'], ['sideB'], ['week'], ['stakes'], ['kind', 'text']];

/** The terms a form would actually submit — custom text left behind after
    switching back to HIGHER SCORE isn't part of it. */
const termsKey = (f: FormState) => (f.kind === 'matchup' ? 'matchup' : `custom:${f.text.trim()}`);

/** After an edit conflict: keep what this user changed since `base`, take
    everything else from `fresh`. Without this, the retry would send this
    form's stale copy of fields someone else just changed — silently
    reverting their edit, which is the thing the etag check exists to stop. */
export function rebaseForm(form: FormState, base: BetRecord, fresh: BetRecord): FormState {
  const was = fromBet(base);
  const now = fromBet(fresh);
  const out = { ...form };
  for (const group of GROUPS) {
    // Compare what would be submitted (trimmed), not raw keystrokes.
    const touched = group.includes('kind')
      ? termsKey(form) !== termsKey(was)
      : group.some((k) => (k === 'stakes' ? form.stakes.trim() !== was.stakes.trim() : form[k] !== was[k]));
    if (!touched) for (const k of group) Object.assign(out, { [k]: now[k] });
  }
  return out;
}
