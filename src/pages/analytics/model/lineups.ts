import type { SeasonLineups, WeekLineup } from '@/shared/api/types';
import type { Position } from '@/shared/config/constants';
import type { Game } from './analytics';

const BASE: readonly Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

/** Which positions each flex slot takes. Slots not listed here (IDP, …) are
    ignored — this league doesn't use them. */
export const FLEX_ELIGIBLE: Record<string, readonly Position[]> = {
  FLEX: ['RB', 'WR', 'TE'],
  WRRB_FLEX: ['RB', 'WR'],
  REC_FLEX: ['WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
};

const eligible = (slot: string): readonly Position[] =>
  (BASE as readonly string[]).includes(slot) ? [slot as Position] : (FLEX_ELIGIBLE[slot] ?? []);

/** The league's starting slots, in Sleeper's order (bench, IR and taxi out).
    `starters[i]` in a matchup fills `slots[i]`. */
export function startingSlots(rosterPositions: string[] | undefined): string[] {
  return (rosterPositions ?? []).filter((s) => s !== 'BN' && s !== 'IR' && s !== 'TAXI');
}

export type PosOf = (playerId: string) => Position | undefined;

/** A player's position, falling back to the dedicated slot he started in when
    the player index doesn't know him at all (an id Sleeper has since purged). */
export function lineupPosOf(posOf: PosOf, lineup: WeekLineup, slots: string[]): PosOf {
  return (id) => {
    const known = posOf(id);
    if (known) return known;
    const i = lineup.s.indexOf(id);
    const slot = i >= 0 ? slots[i] : undefined;
    return slot && (BASE as readonly string[]).includes(slot) ? (slot as Position) : undefined;
  };
}

/** The most points this roster could have started. Dedicated slots are
    filled first, then flex slots from the narrowest (WR/RB) to the widest —
    greedy in that order is optimal because each flex's eligible set contains
    the dedicated slots it competes with. A negative score is never worth
    starting — an empty slot (or a bench player on zero, which the loader
    trims) scores 0 — so only positive scorers are candidates. */
export function optimalPoints(slots: string[], lineup: WeekLineup, posOf: PosOf): number {
  const pool = Object.entries(lineup.pp)
    .map(([id, pts]) => ({ id, pts, pos: posOf(id) }))
    .filter((c): c is { id: string; pts: number; pos: Position } => !!c.pos && c.pts > 0)
    .sort((a, b) => b.pts - a.pts);
  const order = slots
    .map((slot) => ({ slot, ok: eligible(slot) }))
    .filter((x) => x.ok.length > 0)
    .sort((a, b) => a.ok.length - b.ok.length);
  const used = new Set<string>();
  let total = 0;
  for (const { ok } of order) {
    const best = pool.find((c) => !used.has(c.id) && ok.includes(c.pos));
    if (!best) continue;
    used.add(best.id);
    total += best.pts;
  }
  return total;
}

/** What the lineup actually scored: its starters' points. */
export function startedPoints(lineup: WeekLineup): number {
  return lineup.s.reduce((a, id) => a + (id && id !== '0' ? (lineup.pp[id] ?? 0) : 0), 0);
}

const lineupOf = (lineups: SeasonLineups, week: number, r: number) => lineups[week]?.find((l) => l.r === r);

export interface BenchRow {
  rosterId: number;
  actual: number;
  optimal: number;
  /** Points left on the bench. */
  left: number;
  /** actual / optimal — the share of the possible that got started. */
  efficiency: number;
  /** Losses the best possible lineup would have won. */
  blown: number;
  games: number;
}

/** Lineup efficiency per manager over the decided games, best coach first. */
export function benchTable(games: Game[], lineups: SeasonLineups, slots: string[], posOf: PosOf): BenchRow[] {
  const rows = new Map<number, BenchRow>();
  for (const g of games) {
    const lu = lineupOf(lineups, g.week, g.r);
    if (!lu) continue;
    const actual = startedPoints(lu);
    const optimal = Math.max(actual, optimalPoints(slots, lu, lineupPosOf(posOf, lu, slots)));
    const x = rows.get(g.r) ?? { rosterId: g.r, actual: 0, optimal: 0, left: 0, efficiency: 0, blown: 0, games: 0 };
    x.actual += actual;
    x.optimal += optimal;
    x.games += 1;
    // Against what the opponent actually scored: their lineup is a given.
    if (g.pts < g.opp && g.pts + (optimal - actual) > g.opp) x.blown += 1;
    rows.set(g.r, x);
  }
  for (const x of rows.values()) {
    x.left = x.optimal - x.actual;
    x.efficiency = x.optimal ? x.actual / x.optimal : 0;
  }
  return [...rows.values()].sort((a, b) => b.efficiency - a.efficiency || a.rosterId - b.rosterId);
}

export const STRENGTH_POSITIONS: readonly Position[] = BASE;

export interface StrengthRow {
  rosterId: number;
  /** Started points per game from each position (flex starters count toward
      their real position). */
  perGame: Record<Position, number>;
  /** perGame minus the league average for that position. */
  diff: Record<Position, number>;
}

const zero = (): Record<Position, number> => ({ QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 });

/** Where each roster's points come from, against the league. Rows keep the
    order of `rosterIds` (pass the standings order). */
export function positionStrength(
  games: Game[],
  lineups: SeasonLineups,
  slots: string[],
  posOf: PosOf,
  rosterIds: number[],
): { rows: StrengthRow[]; league: Record<Position, number> } {
  const sums = new Map<number, { pts: Record<Position, number>; n: number }>();
  for (const g of games) {
    const lu = lineupOf(lineups, g.week, g.r);
    if (!lu) continue;
    const pos = lineupPosOf(posOf, lu, slots);
    const x = sums.get(g.r) ?? { pts: zero(), n: 0 };
    x.n += 1;
    for (const id of lu.s) {
      const p = id && id !== '0' ? pos(id) : undefined;
      if (p) x.pts[p] += lu.pp[id] ?? 0;
    }
    sums.set(g.r, x);
  }
  const perGame = new Map<number, Record<Position, number>>();
  for (const [r, x] of sums) {
    const pg = zero();
    for (const p of BASE) pg[p] = x.pts[p] / x.n;
    perGame.set(r, pg);
  }
  const league = zero();
  const teams = [...perGame.values()];
  for (const p of BASE) league[p] = teams.length ? teams.reduce((a, t) => a + t[p], 0) / teams.length : 0;
  const rows = rosterIds
    .filter((r) => perGame.has(r))
    .map((r) => {
      const pg = perGame.get(r)!;
      const diff = zero();
      for (const p of BASE) diff[p] = pg[p] - league[p];
      return { rosterId: r, perGame: pg, diff };
    });
  return { rows, league };
}
