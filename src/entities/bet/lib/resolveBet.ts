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
  /** Somebody ruled on it. */
  | { kind: 'settled'; winner: BetSide }
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

/** A bet's wager is frozen once either side has points on the board (or the
    week is over): editing the stakes at halftime is exactly what this stops.
    Per side, not per week — a Thursday kickoff doesn't lock a bet between two
    managers with nobody playing Thursday. */
export function isLocked(scores: SideScores, final: boolean): boolean {
  return final || started(scores);
}

/** Every bet is free text, so a person decides who won — the scores only say
    how far along the week is. */
export function resolveBet(bet: Pick<Bet, 'winner'>, scores: SideScores, final: boolean): BetOutcome {
  if (bet.winner) return { kind: 'settled', winner: bet.winner };
  if (final) return { kind: 'ruling' };
  return started(scores) ? { kind: 'live' } : { kind: 'upcoming' };
}

/** Ruled on — nothing left to happen. Everything else is pending. */
export function isComplete(outcome: BetOutcome): boolean {
  return outcome.kind === 'settled';
}

export interface RecordRow<B extends Bet = Bet> {
  ownerId: string;
  won: B[];
  lost: B[];
}

/** Each manager's bet record for the season: settled, non-deleted bets won and
    lost. Best bettor first. */
export function betRecord<B extends Bet>(entries: Array<{ bet: B; outcome: BetOutcome }>): RecordRow<B>[] {
  const rows = new Map<string, RecordRow<B>>();
  const row = (id: string) => {
    let r = rows.get(id);
    if (!r) rows.set(id, (r = { ownerId: id, won: [], lost: [] }));
    return r;
  };
  for (const { bet, outcome } of entries) {
    if (bet.deletedAt || outcome.kind !== 'settled') continue;
    const [winner, loser] = outcome.winner === 'A' ? [bet.sideA, bet.sideB] : [bet.sideB, bet.sideA];
    row(winner).won.push(bet);
    row(loser).lost.push(bet);
  }
  return [...rows.values()].sort(
    (x, y) => y.won.length - x.won.length || x.lost.length - y.lost.length || x.ownerId.localeCompare(y.ownerId),
  );
}
