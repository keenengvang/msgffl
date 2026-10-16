import type { SeasonWeeks } from '@/shared/api/types';
import { pairMatchups } from '@/entities/matchup/lib/pairMatchups';
import { decidedGames } from './analytics';

/** Teams that skip round one: the bracket is padded to the next power of two,
    and the top seeds fill the gap (6 teams → 2 byes, 8 → 0, 7 → 1). */
export function byeCount(playoffTeams: number): number {
  let size = 1;
  while (size < playoffTeams) size *= 2;
  return size - playoffTeams;
}

export interface OddsRow {
  rosterId: number;
  /** Probabilities, 0–1. */
  playoff: number;
  bye: number;
  /** Finishing the regular season dead last. */
  last: number;
}

export interface OddsInput {
  weeks: SeasonWeeks;
  rosterIds: number[];
  /** Games through this week are final; everything after it is simulated. */
  asOf: number;
  /** The final regular-season week (playoff_week_start − 1). */
  lastRegular: number;
  playoffTeams: number;
  sims?: number;
  seed?: number;
}

/** How much a team's own average is trusted: its mean is shrunk toward the
    league's as if it had played this many extra league-average games. Week-2
    hot streaks regress; by week 10 a team is mostly what it has shown. */
const PRIOR_GAMES = 4;
const DEFAULT_SIMS = 4000;

/** mulberry32 — a tiny seeded PRNG, so the same data always gives the same
    odds (no number flickering between renders, and testable). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Monte Carlo the rest of the regular season from `asOf`.

    Each team's weekly score is drawn from a normal around its (shrunk) scoring
    average with the league's game-to-game spread, the real remaining schedule
    is played out, and the final table is ranked exactly the way the
    standings are (computeStandings) — whole wins, then points for. Odds are the share of simulated seasons a team
    finished in the playoff spots, the bye spots, or last. */
export function playoffOdds(input: OddsInput): OddsRow[] {
  const { weeks, rosterIds, asOf, lastRegular, playoffTeams } = input;
  const sims = input.sims ?? DEFAULT_SIMS;
  const games = decidedGames(weeks, asOf);

  const wins = new Map<number, number>(rosterIds.map((r) => [r, 0]));
  const pf = new Map<number, number>(rosterIds.map((r) => [r, 0]));
  const n = new Map<number, number>(rosterIds.map((r) => [r, 0]));
  for (const g of games) {
    if (!wins.has(g.r)) continue;
    // Whole wins, like computeStandings: a tie isn't half a win in the
    // table, it's a non-win, and PF breaks the tie between equal win counts.
    wins.set(g.r, wins.get(g.r)! + (g.pts > g.opp ? 1 : 0));
    pf.set(g.r, pf.get(g.r)! + g.pts);
    n.set(g.r, n.get(g.r)! + 1);
  }

  const leagueMean = games.length ? games.reduce((a, g) => a + g.pts, 0) / games.length : 100;
  // Spread around each team's own average — the week-to-week noise.
  const resid = games.map((g) => g.pts - pf.get(g.r)! / Math.max(1, n.get(g.r)!));
  const sd = games.length > rosterIds.length ? Math.max(10, Math.sqrt(resid.reduce((a, x) => a + x * x, 0) / resid.length)) : 25;
  const mean = new Map(rosterIds.map((r) => [r, (pf.get(r)! + PRIOR_GAMES * leagueMean) / (n.get(r)! + PRIOR_GAMES)]));

  const schedule: Array<[number, number]> = [];
  for (let w = asOf + 1; w <= lastRegular; w++) {
    for (const [a, b] of pairMatchups(weeks[w] ?? [])) {
      if (wins.has(a.r) && wins.has(b.r)) schedule.push([a.r, b.r]);
    }
  }

  const byes = byeCount(playoffTeams);
  const count = new Map(rosterIds.map((r) => [r, { playoff: 0, bye: 0, last: 0 }]));
  const rand = rng(input.seed ?? 20120);
  // Box–Muller: two uniforms → one standard normal.
  const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  const ids = [...rosterIds];
  const w = new Map<number, number>();
  const p = new Map<number, number>();

  // With nothing left to play the result is certain — one pass is exact.
  const runs = schedule.length ? sims : 1;
  for (let s = 0; s < runs; s++) {
    for (const r of ids) {
      w.set(r, wins.get(r)!);
      p.set(r, pf.get(r)!);
    }
    for (const [a, b] of schedule) {
      const sa = mean.get(a)! + sd * normal();
      const sb = mean.get(b)! + sd * normal();
      p.set(a, p.get(a)! + sa);
      p.set(b, p.get(b)! + sb);
      if (sa > sb) w.set(a, w.get(a)! + 1);
      else w.set(b, w.get(b)! + 1);
    }
    ids.sort((x, y) => w.get(y)! - w.get(x)! || p.get(y)! - p.get(x)! || x - y);
    ids.forEach((r, i) => {
      const c = count.get(r)!;
      if (i < playoffTeams) c.playoff += 1;
      if (i < byes) c.bye += 1;
      if (i === ids.length - 1) c.last += 1;
    });
  }

  return rosterIds.map((r) => {
    const c = count.get(r)!;
    return { rosterId: r, playoff: c.playoff / runs, bye: c.bye / runs, last: c.last / runs };
  });
}

export interface OddsTrack {
  rosterId: number;
  /** Playoff odds after week 0 (preseason), 1, …, through. */
  playoff: number[];
  now: OddsRow;
}

/** Playoff odds as they stood after every week, so you can watch a season
    collapse. The last point is "now" (or the final word, for a done season). */
export function oddsTimeline(input: Omit<OddsInput, 'asOf'> & { through: number }): OddsTrack[] {
  const tracks = new Map<number, number[]>(input.rosterIds.map((r) => [r, []]));
  let now: OddsRow[] = [];
  for (let asOf = 0; asOf <= input.through; asOf++) {
    now = playoffOdds({ ...input, asOf, sims: asOf === input.through ? input.sims : Math.min(input.sims ?? DEFAULT_SIMS, 2000) });
    for (const row of now) tracks.get(row.rosterId)!.push(row.playoff);
  }
  const byId = new Map(now.map((r) => [r.rosterId, r]));
  return input.rosterIds
    .map((r) => ({ rosterId: r, playoff: tracks.get(r)!, now: byId.get(r)! }))
    .sort((a, b) => b.now.playoff - a.now.playoff || b.now.bye - a.now.bye || a.now.last - b.now.last || a.rosterId - b.rosterId);
}
