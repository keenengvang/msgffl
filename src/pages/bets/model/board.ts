import type { SeasonWeeks, TrimmedMatchup } from '@/shared/api/types';
import { betRecord, isComplete, resolveBet, sideScores, type BetOutcome, type RecordRow, type SideScores } from '@/entities/bet/lib/resolveBet';
import type { BetRecord } from '@/entities/bet/model/types';

export interface BoardEntry {
  bet: BetRecord;
  scores: SideScores;
  outcome: BetOutcome;
}

export interface Board {
  /** Live bets, newest week first, then newest booked first. */
  bets: BoardEntry[];
  /** Season bet record per manager (settled bets won/lost). */
  record: RecordRow<BetRecord>[];
}

/** Score and settle every bet against the season's matchups. Pure: the
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
    return { bet, scores, outcome: resolveBet(bet, scores, final) };
  });

  const live = entries
    .filter((e) => !e.bet.deletedAt)
    .sort((x, y) => y.bet.week - x.bet.week || y.bet.createdAt.localeCompare(x.bet.createdAt));

  return {
    bets: live,
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

export type BoardFilter = 'all' | 'pending' | 'completed';

/** The bets the board shows for a status filter and, optionally, one manager. */
export function filterBoard(bets: BoardEntry[], status: BoardFilter, ownerId: string | null): BoardEntry[] {
  return bets.filter(
    (e) =>
      (status === 'all' || (status === 'completed') === isComplete(e.outcome)) &&
      (!ownerId || e.bet.sideA === ownerId || e.bet.sideB === ownerId),
  );
}

export type RecordSortKey = 'name' | 'won' | 'lost' | 'open' | 'pct';
export interface RecordSort {
  key: RecordSortKey;
  dir: 'asc' | 'desc';
}

/** Won ÷ decided, null until something's been decided (0-0 isn't 0%). */
export const winPct = (r: RecordRow<BetRecord>): number | null => {
  const decided = r.won.length + r.lost.length;
  return decided ? r.won.length / decided : null;
};

/** Sort the bet-record table by a column. Undecided win% always sinks to the
    bottom whichever way you sort; ties fall back to wins, then fewest losses,
    then name, so the order never jitters. */
export function sortRecord(
  rows: RecordRow<BetRecord>[],
  sort: RecordSort,
  nameOf: (ownerId: string) => string,
): RecordRow<BetRecord>[] {
  const sign = sort.dir === 'asc' ? 1 : -1;
  const by = (r: RecordRow<BetRecord>): number | string | null => {
    switch (sort.key) {
      case 'name':
        return nameOf(r.ownerId).toLowerCase();
      case 'won':
        return r.won.length;
      case 'lost':
        return r.lost.length;
      case 'open':
        return r.open.length;
      case 'pct':
        return winPct(r);
    }
  };
  const tiebreak = (x: RecordRow<BetRecord>, y: RecordRow<BetRecord>) =>
    y.won.length - x.won.length || x.lost.length - y.lost.length || nameOf(x.ownerId).localeCompare(nameOf(y.ownerId));
  return [...rows].sort((x, y) => {
    const a = by(x);
    const b = by(y);
    if (a === null || b === null) return a === b ? tiebreak(x, y) : a === null ? 1 : -1;
    const cmp = typeof a === 'string' ? a.localeCompare(b as string) : a - (b as number);
    return cmp * sign || tiebreak(x, y);
  });
}
