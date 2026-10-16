import type { SeasonWeeks } from '@/shared/api/types';
import { pairMatchups } from '@/entities/matchup/lib/pairMatchups';

/** One team's result in one decided game. */
interface Game {
  week: number;
  r: number;
  pts: number;
  opp: number;
}

/** Every decided regular-season game through `through` (inclusive). A week's
    0–0 pairs are unplayed, not ties, so they're skipped — the same rule the
    record book and H2H use. */
export function decidedGames(weeks: SeasonWeeks | undefined, through: number): Game[] {
  const out: Game[] = [];
  for (let w = 1; w <= through; w++) {
    for (const [a, b] of pairMatchups(weeks?.[w] ?? [])) {
      if ((a.p || 0) === 0 && (b.p || 0) === 0) continue;
      out.push({ week: w, r: a.r, pts: a.p, opp: b.p }, { week: w, r: b.r, pts: b.p, opp: a.p });
    }
  }
  return out;
}

/** The last week whose games count: regular season only, and never the week in
    progress (half-scored games would skew every number). */
/** The live week from the standings alone, for when /state/nfl is down:
    Sleeper only adds a game to a roster's record once that week is final,
    so the most games anyone has played is the last final week. */
export function liveWeekFromRecords(records: { w: number; l: number; t: number }[]): number {
  return Math.max(0, ...records.map((r) => r.w + r.l + r.t)) + 1;
}

export function analyticsThrough(input: {
  complete: boolean;
  playoffWeekStart: number;
  liveWeek: number;
}): number {
  const lastRegular = input.playoffWeekStart - 1;
  return input.complete ? lastRegular : Math.min(lastRegular, input.liveWeek - 1);
}

export interface LuckRow {
  rosterId: number;
  games: number;
  /** Actual record. Ties count half. */
  w: number;
  l: number;
  t: number;
  winPct: number;
  /** All-play: every week, your score against all the other teams that played. */
  apW: number;
  apL: number;
  apT: number;
  apPct: number;
  /** winPct − apPct. Positive = winning more than the scoring deserves. */
  luck: number;
}

const pct = (w: number, l: number, t: number) => (w + l + t ? (w + t / 2) / (w + l + t) : 0);

/** Actual vs all-play record per team, luckiest first. */
export function luckTable(games: Game[]): LuckRow[] {
  const rows = new Map<number, LuckRow>();
  const row = (r: number) => {
    let x = rows.get(r);
    if (!x) rows.set(r, (x = { rosterId: r, games: 0, w: 0, l: 0, t: 0, winPct: 0, apW: 0, apL: 0, apT: 0, apPct: 0, luck: 0 }));
    return x;
  };
  const byWeek = new Map<number, Game[]>();
  for (const g of games) {
    const x = row(g.r);
    x.games += 1;
    if (g.pts > g.opp) x.w += 1;
    else if (g.pts < g.opp) x.l += 1;
    else x.t += 1;
    byWeek.set(g.week, [...(byWeek.get(g.week) ?? []), g]);
  }
  for (const list of byWeek.values()) {
    for (const g of list) {
      const x = row(g.r);
      for (const o of list) {
        if (o.r === g.r) continue;
        if (g.pts > o.pts) x.apW += 1;
        else if (g.pts < o.pts) x.apL += 1;
        else x.apT += 1;
      }
    }
  }
  for (const x of rows.values()) {
    x.winPct = pct(x.w, x.l, x.t);
    x.apPct = pct(x.apW, x.apL, x.apT);
    x.luck = x.winPct - x.apPct;
  }
  return [...rows.values()].sort((a, b) => b.luck - a.luck || a.rosterId - b.rosterId);
}

export interface RaceRow {
  rosterId: number;
  /** Rank after each week 1…through (1 = first). */
  ranks: number[];
}

/** League rank after every week: wins (ties half), then points-for — the
    standings tiebreak — then roster id so the order never jitters. */
export function standingsRace(games: Game[], rosterIds: number[], through: number): RaceRow[] {
  const wins = new Map<number, number>(rosterIds.map((r) => [r, 0]));
  const pf = new Map<number, number>(rosterIds.map((r) => [r, 0]));
  const ranks = new Map<number, number[]>(rosterIds.map((r) => [r, []]));
  for (let w = 1; w <= through; w++) {
    for (const g of games) {
      if (g.week !== w || !wins.has(g.r)) continue;
      wins.set(g.r, wins.get(g.r)! + (g.pts > g.opp ? 1 : g.pts === g.opp ? 0.5 : 0));
      pf.set(g.r, pf.get(g.r)! + g.pts);
    }
    const order = [...rosterIds].sort((a, b) => wins.get(b)! - wins.get(a)! || pf.get(b)! - pf.get(a)! || a - b);
    order.forEach((r, i) => ranks.get(r)!.push(i + 1));
  }
  return rosterIds.map((r) => ({ rosterId: r, ranks: ranks.get(r)! }));
}

export interface SpreadRow {
  rosterId: number;
  scores: Array<{ week: number; pts: number }>;
  avg: number;
  min: number;
  max: number;
  /** Population standard deviation — the boom-or-bust number. */
  sd: number;
}

/** Every weekly score per team, steadiest first. */
export function scoreSpread(games: Game[]): SpreadRow[] {
  const by = new Map<number, Array<{ week: number; pts: number }>>();
  for (const g of games) by.set(g.r, [...(by.get(g.r) ?? []), { week: g.week, pts: g.pts }]);
  return [...by.entries()]
    .map(([rosterId, scores]) => {
      const pts = scores.map((s) => s.pts);
      const avg = pts.reduce((a, b) => a + b, 0) / pts.length;
      const sd = Math.sqrt(pts.reduce((a, p) => a + (p - avg) ** 2, 0) / pts.length);
      return { rosterId, scores, avg, min: Math.min(...pts), max: Math.max(...pts), sd };
    })
    .sort((a, b) => b.avg - a.avg || a.rosterId - b.rosterId);
}
