import type { Transaction } from '@/shared/api/types';

/** A transaction trimmed to what anyone asks about: who, what, when, for how much. */
export interface Move {
  id: string;
  season: string;
  week: number;
  type: Transaction['type'];
  /** A failed waiver claim (outbid, roster full, over budget) — it never happened. */
  failed: boolean;
  rosterIds: number[];
  /** player_id → roster_id that received / gave up the player. */
  adds: Record<string, number>;
  drops: Record<string, number>;
  /** The FAAB bid on a waiver claim; null on everything else. */
  bid: number | null;
  /** FAAB moved between rosters in a trade. */
  faab: { from: number; to: number; amount: number }[];
  picks: { season: string; round: number; originalRosterId: number; from: number; to: number }[];
  at: number;
  /** Sleeper's reason a claim failed, e.g. "claimed by another owner". */
  note?: string;
}

/** Wire → Move. Drops commissioner edits, which are housekeeping, not moves. */
export function trimMoves(raw: Transaction[], season: string): Move[] {
  return raw
    .filter((t) => t.type !== 'commissioner')
    .map((t) => {
      const failed = t.status !== 'complete';
      return {
        id: t.transaction_id,
        season,
        week: t.leg,
        type: t.type,
        failed,
        rosterIds: t.roster_ids ?? [],
        adds: t.adds ?? {},
        drops: t.drops ?? {},
        bid: t.type === 'waiver' ? (t.settings?.waiver_bid ?? 0) : null,
        faab: (t.waiver_budget ?? []).map((b) => ({ from: b.sender, to: b.receiver, amount: b.amount })),
        picks: (t.draft_picks ?? []).map((p) => ({
          season: p.season,
          round: p.round,
          originalRosterId: p.roster_id,
          from: p.previous_owner_id,
          to: p.owner_id,
        })),
        at: t.status_updated ?? t.created,
        ...(failed && t.metadata?.notes ? { note: t.metadata.notes } : {}),
      };
    });
}

export interface FaabLine {
  /** FAAB actually spent: winning bids only. A losing bid costs nothing. */
  spent: number;
  claims: number;
  biggest: number;
}

/** FAAB spent per key (roster id, owner id — whatever `keyOf` returns), from
    winning waiver claims only. Traded FAAB moves budget, it isn't spending. */
export function faabSpend(moves: Move[], keyOf: (m: Move) => string | undefined): Record<string, FaabLine> {
  const out: Record<string, FaabLine> = {};
  for (const m of moves) {
    if (m.type !== 'waiver' || m.failed) continue;
    const k = keyOf(m);
    if (k === undefined) continue;
    const line = (out[k] ??= { spent: 0, claims: 0, biggest: 0 });
    const bid = m.bid ?? 0;
    line.spent += bid;
    line.claims += 1;
    line.biggest = Math.max(line.biggest, bid);
  }
  return out;
}

/** Biggest winning bid first; ties go to the most recent claim. */
export function byBid(a: Move, b: Move): number {
  return (b.bid ?? -1) - (a.bid ?? -1) || b.at - a.at;
}
