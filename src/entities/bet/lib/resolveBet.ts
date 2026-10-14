import type { TrimmedMatchup } from '@/shared/api/types';
import type { Bet, BetSide } from '../model/types';

/** Each side's points that week. null = no matchup row for that owner (not in
    the league that season, or Sleeper hasn't posted the week). */
export interface SideScores {
  a: number | null;
  b: number | null;
}

export type BetOutcome =
  /** Nobody on either side has scored yet. */
  | { kind: 'upcoming' }
  /** Points on the board, week not over. `leader` is null on a tie or a custom bet. */
  | { kind: 'live'; a: number; b: number; leader: BetSide | null }
  | { kind: 'settled'; winner: BetSide }
  | { kind: 'push'; a: number; b: number }
  /** Custom bet, week over, nobody has said who won. */
  | { kind: 'ruling' }
  /** Matchup bet, week over, but a side has no score to compare. */
  | { kind: 'unknown' };

export function sideScores(
  bet: Pick<Bet, 'sideA' | 'sideB'>,
  rows: TrimmedMatchup[] | undefined,
  rosterOf: Record<string, number>,
): SideScores {
  const pts = (owner: string) => {
    const rid = rosterOf[owner];
    if (rid == null) return null;
    const row = (rows ?? []).find((e) => e.r === rid);
    return row ? row.p || 0 : null;
  };
  return { a: pts(bet.sideA), b: pts(bet.sideB) };
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

const started = (s: SideScores) => (s.a ?? 0) > 0 || (s.b ?? 0) > 0;

/** A bet's wager is frozen once either side has points on the board (or the
    week is over): editing the stakes at halftime is exactly what this stops.
    Per side, not per week — a Thursday kickoff doesn't lock a bet between two
    managers with nobody playing Thursday. */
export function isLocked(scores: SideScores, final: boolean): boolean {
  return final || started(scores);
}

export function resolveBet(bet: Pick<Bet, 'terms' | 'winner'>, scores: SideScores, final: boolean): BetOutcome {
  const a = scores.a ?? 0;
  const b = scores.b ?? 0;

  if (bet.terms.kind === 'custom') {
    if (bet.winner) return { kind: 'settled', winner: bet.winner };
    if (final) return { kind: 'ruling' };
    return started(scores) ? { kind: 'live', a, b, leader: null } : { kind: 'upcoming' };
  }

  if (final) {
    // 0–0 in a "final" week means nobody played (bye, eliminated, not posted) —
    // calling that a push would settle a bet on nothing.
    if (scores.a == null || scores.b == null || !started(scores)) return { kind: 'unknown' };
    if (a === b) return { kind: 'push', a, b };
    return { kind: 'settled', winner: a > b ? 'A' : 'B' };
  }
  if (!started(scores)) return { kind: 'upcoming' };
  return { kind: 'live', a, b, leader: a === b ? null : a > b ? 'A' : 'B' };
}

/** Who pays whom on a settled bet. */
export function debtOf(bet: Pick<Bet, 'sideA' | 'sideB'>, outcome: BetOutcome): { debtor: string; creditor: string } | null {
  if (outcome.kind !== 'settled') return null;
  return outcome.winner === 'A'
    ? { debtor: bet.sideB, creditor: bet.sideA }
    : { debtor: bet.sideA, creditor: bet.sideB };
}

export interface LedgerRow<B extends Bet = Bet> {
  ownerId: string;
  /** Unpaid bets this manager lost. */
  owes: B[];
  /** Unpaid bets this manager won. */
  owed: B[];
}

/** The tab: every unpaid, settled, non-deleted bet, per manager. Stakes are
    free text ("a keg", "$20"), so this lists debts rather than summing them.
    Worst offenders first. */
export function ledger<B extends Bet>(entries: Array<{ bet: B; outcome: BetOutcome }>): LedgerRow<B>[] {
  const rows = new Map<string, LedgerRow<B>>();
  const row = (id: string) => {
    let r = rows.get(id);
    if (!r) rows.set(id, (r = { ownerId: id, owes: [], owed: [] }));
    return r;
  };
  for (const { bet, outcome } of entries) {
    if (bet.paid || bet.deletedAt) continue;
    const d = debtOf(bet, outcome);
    if (!d) continue;
    row(d.debtor).owes.push(bet);
    row(d.creditor).owed.push(bet);
  }
  return [...rows.values()].sort(
    (x, y) => y.owes.length - x.owes.length || x.owed.length - y.owed.length || x.ownerId.localeCompare(y.ownerId),
  );
}
