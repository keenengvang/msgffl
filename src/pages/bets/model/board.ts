import type { SeasonWeeks, TrimmedMatchup } from '@/shared/api/types';
import { betRecord, isLocked, resolveBet, sideScores, type BetOutcome, type RecordRow, type SideScores } from '@/entities/bet/lib/resolveBet';
import type { BetRecord } from '@/entities/bet/model/types';

export interface BoardEntry {
  bet: BetRecord;
  scores: SideScores;
  outcome: BetOutcome;
  locked: boolean;
}

export interface Board {
  /** Live bets, grouped by week, newest week first. */
  weeks: Array<{ week: number; entries: BoardEntry[] }>;
  /** Tombstoned bets — shown apart, restorable. */
  shredded: BoardEntry[];
  /** Season bet record per manager (settled bets won/lost). */
  record: RecordRow<BetRecord>[];
}

/** Score, settle and lock every bet against the season's matchups. Pure: the
    page passes in whatever week data it has (live poll or the 17-week bundle). */
export function buildBoard(
  bets: BetRecord[],
  ctx: {
    rowsFor: (week: number) => TrimmedMatchup[] | undefined;
    rosterOf: Record<string, number>;
    isFinal: (week: number) => boolean;
  },
): Board {
  const entries = bets.map((bet): BoardEntry => {
    const scores = sideScores(bet, ctx.rowsFor(bet.week), ctx.rosterOf);
    const final = ctx.isFinal(bet.week);
    return { bet, scores, outcome: resolveBet(bet, scores, final), locked: isLocked(scores, final) };
  });

  const live = entries.filter((e) => !e.bet.deletedAt);
  const byWeek = new Map<number, BoardEntry[]>();
  live.forEach((e) => byWeek.set(e.bet.week, [...(byWeek.get(e.bet.week) ?? []), e]));

  return {
    weeks: [...byWeek.entries()].sort(([a], [b]) => b - a).map(([week, list]) => ({ week, entries: list })),
    shredded: entries.filter((e) => e.bet.deletedAt),
    record: betRecord(live),
  };
}

/** The latest week with any points on the board (0 if none). A week is over
    once a later one has started — a signal straight from the scores, so the
    board still settles past weeks when Sleeper's NFL-state call fails. */
export function lastScoredWeek(weeks: SeasonWeeks | undefined): number {
  let last = 0;
  for (const [w, rows] of Object.entries(weeks ?? {})) {
    if (rows.some((r) => (r.p || 0) !== 0)) last = Math.max(last, Number(w));
  }
  return last;
}
