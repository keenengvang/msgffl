import type { DraftPick, SeasonLineups } from '@/shared/api/types';
import type { Move } from '@/entities/transaction/lib/moves';

export interface PickValue {
  pickNo: number;
  round: number;
  rosterId: number;
  playerId: string;
  name: string;
  pos: string;
  /** Points he scored in the drafting team's starting lineup. */
  pts: number;
  /** What a pick in this slot usually returns (see draftValue). */
  expected: number;
  /** pts − expected: positive is a steal, negative a bust. */
  value: number;
}

export interface DraftClass {
  rosterId: number;
  /** Total value over expectation across the class. */
  value: number;
  total: number;
  best: PickValue;
  worst: PickValue;
}

/** Picks either side used to set a slot's expectation. */
const WINDOW = 7;

/** Points `playerId` scored in `rosterId`'s starting lineup, weeks 1…through. */
export function startedFor(lineups: SeasonLineups, rosterId: number, playerId: string, from: number, through: number): number {
  let pts = 0;
  for (let w = Math.max(1, from); w <= through; w++) {
    const lu = lineups[w]?.find((l) => l.r === rosterId);
    if (lu?.s.includes(playerId)) pts += lu.pp[playerId] ?? 0;
  }
  return pts;
}

/** Value over pick: what each pick actually gave the team that made it —
    points in its starting lineup, not the player's season total, so a pick
    cut in week 1 who went on to star for someone else is a bust for the
    drafter (and shows up as the other team's waiver win). Measured against
    what the picks around the slot returned (a moving average of ±7 picks):
    a 1st-rounder has to beat other 1st-rounders, not the 12th round. */
export function draftValue(picks: DraftPick[], lineups: SeasonLineups, through: number): { picks: PickValue[]; classes: DraftClass[] } {
  const ordered = [...picks].filter((p) => p.roster_id).sort((a, b) => a.pick_no - b.pick_no);
  const pts = ordered.map((p) => startedFor(lineups, p.roster_id, p.player_id, 1, through));
  const out: PickValue[] = ordered.map((p, i) => {
    const lo = Math.max(0, i - WINDOW);
    const hi = Math.min(ordered.length, i + WINDOW + 1);
    const near = pts.slice(lo, hi);
    const expected = near.reduce((a, x) => a + x, 0) / near.length;
    const name = [p.metadata?.first_name, p.metadata?.last_name].filter(Boolean).join(' ') || p.player_id;
    return {
      pickNo: p.pick_no,
      round: p.round,
      rosterId: p.roster_id,
      playerId: p.player_id,
      name,
      pos: p.metadata?.position ?? '',
      pts: pts[i]!,
      expected,
      value: pts[i]! - expected,
    };
  });
  const by = new Map<number, PickValue[]>();
  for (const v of out) by.set(v.rosterId, [...(by.get(v.rosterId) ?? []), v]);
  const classes = [...by.entries()]
    .map(([rosterId, list]) => {
      const sorted = [...list].sort((a, b) => b.value - a.value);
      return {
        rosterId,
        value: list.reduce((a, v) => a + v.value, 0),
        total: list.reduce((a, v) => a + v.pts, 0),
        best: sorted[0]!,
        worst: sorted.at(-1)!,
      };
    })
    .sort((a, b) => b.value - a.value || a.rosterId - b.rosterId);
  return { picks: out, classes };
}

export interface Pickup {
  rosterId: number;
  playerId: string;
  week: number;
  type: 'waiver' | 'free_agent';
  /** Winning FAAB bid; 0 for a free agent. */
  bid: number;
  /** Points he scored in this roster's starting lineup from the add onward. */
  started: number;
}

export interface PickupRow {
  rosterId: number;
  /** FAAB spent on winning claims. */
  faab: number;
  adds: number;
  /** Starting-lineup points from every player picked up off the wire. */
  started: number;
  /** started / faab — null when nothing was spent. */
  perDollar: number | null;
}

/** Waiver-wire return: what each roster got out of its pickups, counted only
    while they were in the starting lineup (bench points win nothing).
    Through `through`: a claim after the cutoff (this week's, or a playoff
    week's) can't have scored inside it yet, so it isn't charged either.
    Trades are excluded — they aren't the wire. */
export function pickupValue(moves: Move[], lineups: SeasonLineups, through: number): { rows: PickupRow[]; pickups: Pickup[] } {
  const first = new Map<string, Pickup>();
  for (const m of moves) {
    if (m.failed || (m.type !== 'waiver' && m.type !== 'free_agent') || m.week > through) continue;
    for (const [playerId, rosterId] of Object.entries(m.adds)) {
      const key = `${rosterId}|${playerId}`;
      const prev = first.get(key);
      const bid = m.type === 'waiver' ? (m.bid ?? 0) : 0;
      // Re-adding the same player later doesn't count his points twice.
      if (prev && prev.week <= m.week) {
        prev.bid += bid;
        continue;
      }
      first.set(key, { rosterId, playerId, week: m.week, type: m.type, bid: bid + (prev?.bid ?? 0), started: 0 });
    }
  }
  const pickups = [...first.values()];
  for (const p of pickups) p.started = startedFor(lineups, p.rosterId, p.playerId, p.week, through);
  const rows = new Map<number, PickupRow>();
  for (const p of pickups) {
    const x = rows.get(p.rosterId) ?? { rosterId: p.rosterId, faab: 0, adds: 0, started: 0, perDollar: null };
    x.faab += p.bid;
    x.adds += 1;
    x.started += p.started;
    rows.set(p.rosterId, x);
  }
  for (const x of rows.values()) x.perDollar = x.faab > 0 ? x.started / x.faab : null;
  return {
    rows: [...rows.values()].sort((a, b) => b.started - a.started || a.rosterId - b.rosterId),
    pickups: pickups.sort((a, b) => b.started - a.started || a.week - b.week),
  };
}
