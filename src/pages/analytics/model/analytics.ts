import type { SeasonWeeks } from '@/shared/api/types';
import { pairMatchups } from '@/entities/matchup/lib/pairMatchups';

/** One team's result in one decided game. */
export interface Game {
  week: number;
  r: number;
  pts: number;
  /** The opponent's roster id and score. */
  oppR: number;
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
      out.push({ week: w, r: a.r, pts: a.p, oppR: b.r, opp: b.p }, { week: w, r: b.r, pts: b.p, oppR: a.r, opp: a.p });
    }
  }
  return out;
}

/** The live week from the standings alone, for when /state/nfl is down:
    Sleeper only adds a game to a roster's record once that week is final,
    so the most games anyone has played is the last final week. */
export function liveWeekFromRecords(records: { w: number; l: number; t: number }[]): number {
  return Math.max(0, ...records.map((r) => r.w + r.l + r.t)) + 1;
}

/** The last week whose games count: regular season only, and never the week in
    progress (half-scored games would skew every number). */
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
  /** The same thing in wins: actual wins minus the wins all-play says you'd
      expect over this many games. "+2.6" reads better than "+19%". */
  luckWins: number;
}

const pct = (w: number, l: number, t: number) => (w + l + t ? (w + t / 2) / (w + l + t) : 0);

/** Actual vs all-play record per team, luckiest first. */
export function luckTable(games: Game[]): LuckRow[] {
  const rows = new Map<number, LuckRow>();
  const row = (r: number) => {
    let x = rows.get(r);
    if (!x) rows.set(r, (x = { rosterId: r, games: 0, w: 0, l: 0, t: 0, winPct: 0, apW: 0, apL: 0, apT: 0, apPct: 0, luck: 0, luckWins: 0 }));
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
    x.luckWins = x.luck * x.games;
  }
  return [...rows.values()].sort((a, b) => b.luck - a.luck || a.rosterId - b.rosterId);
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

export interface HeatCell {
  pts: number;
  /** 1 = the week's top score. */
  rank: number;
  /** How many teams scored that week. */
  of: number;
}

/** Each team's score and league rank, week by week: rosterId → week → cell. */
export function weeklyHeat(games: Game[]): Map<number, Map<number, HeatCell>> {
  const byWeek = new Map<number, Game[]>();
  for (const g of games) byWeek.set(g.week, [...(byWeek.get(g.week) ?? []), g]);
  const out = new Map<number, Map<number, HeatCell>>();
  for (const [week, list] of byWeek) {
    for (const g of list) {
      const rank = 1 + list.filter((o) => o.pts > g.pts).length;
      if (!out.has(g.r)) out.set(g.r, new Map());
      out.get(g.r)!.set(week, { pts: g.pts, rank, of: list.length });
    }
  }
  return out;
}

export interface ScheduleRow {
  rosterId: number;
  /** The average weekly score of the opponents you drew, over their season. */
  oppAvg: number;
  /** oppAvg − the league's average score. Positive = a harder schedule. */
  diff: number;
  /** What opponents actually put up against you, per game. */
  paPerGame: number;
}

/** Strength of schedule, hardest first. Graded on opponents' season averages
    rather than points against, which mostly measures which week you met them. */
export function scheduleStrength(games: Game[]): ScheduleRow[] {
  if (!games.length) return [];
  const sum = new Map<number, { pts: number; n: number }>();
  for (const g of games) {
    const x = sum.get(g.r) ?? { pts: 0, n: 0 };
    sum.set(g.r, { pts: x.pts + g.pts, n: x.n + 1 });
  }
  const avgOf = (r: number) => {
    const x = sum.get(r);
    return x ? x.pts / x.n : 0;
  };
  const league = games.reduce((a, g) => a + g.pts, 0) / games.length;
  const by = new Map<number, Game[]>();
  for (const g of games) by.set(g.r, [...(by.get(g.r) ?? []), g]);
  return [...by.entries()]
    .map(([rosterId, list]) => {
      const oppAvg = list.reduce((a, g) => a + avgOf(g.oppR), 0) / list.length;
      return { rosterId, oppAvg, diff: oppAvg - league, paPerGame: list.reduce((a, g) => a + g.opp, 0) / list.length };
    })
    .sort((a, b) => b.diff - a.diff || a.rosterId - b.rosterId);
}

export interface CloseRow {
  rosterId: number;
  w: number;
  l: number;
  t: number;
  /** All decided games, for context: 3–1 in close ones out of 10 played. */
  games: number;
}

/** Record in games decided by less than `margin` points — clutch, or lucky.
    Best close-game win% first; teams with no close games sink. */
export function closeGames(games: Game[], margin = 10): CloseRow[] {
  const rows = new Map<number, CloseRow>();
  for (const g of games) {
    const x = rows.get(g.r) ?? { rosterId: g.r, w: 0, l: 0, t: 0, games: 0 };
    x.games += 1;
    if (Math.abs(g.pts - g.opp) < margin) {
      if (g.pts > g.opp) x.w += 1;
      else if (g.pts < g.opp) x.l += 1;
      else x.t += 1;
    }
    rows.set(g.r, x);
  }
  const pctOf = (x: CloseRow) => (x.w + x.l + x.t ? (x.w + x.t / 2) / (x.w + x.l + x.t) : -1);
  return [...rows.values()].sort((a, b) => pctOf(b) - pctOf(a) || b.w - a.w || a.l - b.l || a.rosterId - b.rosterId);
}
