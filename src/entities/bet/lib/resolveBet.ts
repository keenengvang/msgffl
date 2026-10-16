import type { TrimmedMatchup } from '@/shared/api/types';
import type { Bet, BetSide } from '../model/types';

/** Each side's points that week. null = no matchup row for that owner (not in
    the league that season, or Sleeper hasn't posted the week). */
export interface SideScores {
  a: number | null;
  b: number | null;
}

export type BetOutcome =
  /** Nobody on either team has scored yet. */
  | { kind: 'upcoming' }
  /** Points on the board, week not over, no ruling yet. */
  | { kind: 'live' }
  /** Somebody ruled on it — and the loser has paid up, or hasn't yet. */
  | { kind: 'settled'; winner: BetSide; paid: boolean }
  /** Week's over and nobody has said who won. */
  | { kind: 'ruling' };

export function sideScores(
  bet: Pick<Bet, 'sideA' | 'sideB'> & Partial<Pick<Bet, 'rosterA' | 'rosterB'>>,
  rows: TrimmedMatchup[] | undefined,
  rosterOf: Record<string, number>,
): SideScores {
  const pts = (owner: string, stored: number | null | undefined) => {
    const rid = stored ?? rosterOf[owner];
    if (rid == null) return null;
    const row = (rows ?? []).find((e) => e.r === rid);
    return row ? row.p || 0 : null;
  };
  return { a: pts(bet.sideA, bet.rosterA), b: pts(bet.sideB, bet.rosterB) };
}

/** Is a week's scoring done? A complete season, an earlier season, or an NFL
    week that has moved past it. Unknown NFL state → not final (a bet stays
    "live" a bit longer rather than settling on half a week). */
export function weekIsFinal(
  input: { status: string | undefined; season: string; nflSeason: string | undefined; nflWeek: number | undefined },
  week: number,
): boolean {
  if (input.status === 'complete') return true;
  if (!input.nflSeason) return false;
  if (Number(input.season) < Number(input.nflSeason)) return true;
  return input.season === input.nflSeason && input.nflWeek != null && input.nflWeek > week;
}

// Nonzero, not positive: a Thursday kicker's missed PAT can open a team at -1,
// and that game has very much started.
const started = (s: SideScores) => (s.a ?? 0) !== 0 || (s.b ?? 0) !== 0;

/** Every bet is free text, so a person decides who won — the scores only say
    how far along the week is. */
export function resolveBet(bet: Pick<Bet, 'winner' | 'paidAt'>, scores: SideScores, final: boolean): BetOutcome {
  if (bet.winner) return { kind: 'settled', winner: bet.winner, paid: !!bet.paidAt };
  if (final) return { kind: 'ruling' };
  return started(scores) ? { kind: 'live' } : { kind: 'upcoming' };
}

/** Ruled on and paid — nothing left to happen. */
export function isComplete(outcome: BetOutcome): boolean {
  return outcome.kind === 'settled' && outcome.paid;
}

/** Ruled on, but the loser hasn't paid yet. */
export function isOwed(outcome: BetOutcome): boolean {
  return outcome.kind === 'settled' && !outcome.paid;
}

export interface RecordRow<B extends Bet = Bet> {
  ownerId: string;
  won: B[];
  lost: B[];
  /** Not ruled on yet — still in play. */
  open: B[];
  /** Lost and not paid yet — the debts. A subset of `lost`. */
  owes: B[];
}

/** Each manager's bet record for the season: non-deleted bets won, lost,
    still open and still owed. Anyone with a bet on the books gets a row.
    Best bettor first. */
export function betRecord<B extends Bet>(entries: Array<{ bet: B; outcome: BetOutcome }>): RecordRow<B>[] {
  const rows = new Map<string, RecordRow<B>>();
  const row = (id: string) => {
    let r = rows.get(id);
    if (!r) rows.set(id, (r = { ownerId: id, won: [], lost: [], open: [], owes: [] }));
    return r;
  };
  for (const { bet, outcome } of entries) {
    if (bet.deletedAt) continue;
    if (outcome.kind !== 'settled') {
      row(bet.sideA).open.push(bet);
      row(bet.sideB).open.push(bet);
      continue;
    }
    const [winner, loser] = outcome.winner === 'A' ? [bet.sideA, bet.sideB] : [bet.sideB, bet.sideA];
    row(winner).won.push(bet);
    row(loser).lost.push(bet);
    if (!outcome.paid) row(loser).owes.push(bet);
  }
  return [...rows.values()].sort(
    (x, y) => y.won.length - x.won.length || x.lost.length - y.lost.length || x.ownerId.localeCompare(y.ownerId),
  );
}
