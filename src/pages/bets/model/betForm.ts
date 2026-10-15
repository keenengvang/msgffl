import type { BetDraft, BetPatch, BetRecord } from '@/entities/bet/model/types';

/** The bet form's local fields. */
export interface FormState {
  sideA: string;
  sideB: string;
  week: number;
  terms: string;
}

export const fromBet = (b: BetRecord): FormState => ({ sideA: b.sideA, sideB: b.sideB, week: b.week, terms: b.terms });

/** Only what changed — an edit that doesn't touch the wager shouldn't trip the kickoff lock. */
export function diff(before: BetRecord, d: BetDraft): BetPatch {
  const p: BetPatch = {};
  if (d.week !== before.week) p.week = d.week;
  if (d.sideA !== before.sideA) p.sideA = d.sideA;
  if (d.sideB !== before.sideB) p.sideB = d.sideB;
  if (d.terms !== before.terms) p.terms = d.terms;
  return p;
}

const FIELDS = ['sideA', 'sideB', 'week', 'terms'] as const;

/** After an edit conflict: keep what this user changed since `base`, take
    everything else from `fresh`. Without this, the retry would send this
    form's stale copy of fields someone else just changed — silently
    reverting their edit, which is the thing the etag check exists to stop.
    Terms compare trimmed, the value that would actually be submitted. */
export function rebaseForm(form: FormState, base: BetRecord, fresh: BetRecord): FormState {
  const was = fromBet(base);
  const now = fromBet(fresh);
  const out = { ...form };
  for (const k of FIELDS) {
    const touched = k === 'terms' ? form.terms.trim() !== was.terms.trim() : form[k] !== was[k];
    if (!touched) Object.assign(out, { [k]: now[k] });
  }
  return out;
}

/** Placeholder bets, filled with the teams and week picked so far. A few to
    rotate through so the box always suggests something worth stealing. */
const SAVAGE = [
  'If {A} loses to {B} in Week {W}, {A} owes {B} a keg of Busch Light, delivered to the draft and tapped on bended knee.',
  'Loser of {A} vs {B} in Week {W} Venmos $50 and makes the winner their Sleeper avatar for a week. No cropping.',
  "If {A} scores under 100 in Week {W}, {A} shows up to the next league night in a full Cowboys fit. Photos or it didn't happen.",
  "If {B}'s QB outscores {A}'s whole bench in Week {W}, {A} buys {B} a bottle of Crown and posts an apology in the group chat.",
  'Whoever loses {A} vs {B} in Week {W} covers the next Buffalo Wild Wings run: wings, beers and a 30% tip.',
];
const POLITE = [
  'If {A} loses to {B} in Week {W}, {A} buys {B} a 30-rack at the next league get-together.',
  'Loser of {A} vs {B} in Week {W} sends the winner $20.',
  'If {A} outscores {B} in Week {W}, {B} buys the first round at the draft.',
  'Whoever scores less in {A} vs {B}, Week {W}, brings the snacks to the next watch party.',
];

export function placeholderBet(i: number, savage: boolean, a: string, b: string, week: number): string {
  const pool = savage ? SAVAGE : POLITE;
  return pool[i % pool.length]!.replaceAll('{A}', a).replaceAll('{B}', b).replaceAll('{W}', String(week));
}
