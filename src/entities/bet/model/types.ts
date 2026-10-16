/** A side bet between two managers. Stored server-side (Netlify Blobs, one key
    per bet) — see netlify/functions/bets.ts. Sides are Sleeper owner_ids, which
    are stable across seasons; roster_ids are not. */
export type BetSide = 'A' | 'B';

export interface Bet {
  id: string;
  season: string;
  week: number;
  /** Team A / Team B — the managers' owner_ids. */
  sideA: string;
  sideB: string;
  /** The roster each side managed that season, captured when the side was
      set, so the card's scores still resolve if a team later changes owners.
      null → fall back to the current owner mapping. */
  rosterA: number | null;
  rosterB: number | null;
  /** The whole wager, terms and stakes, in the league's own words: "If A loses
      to B in Week 7, A owes B a keg of Busch Light at the draft." */
  terms: string;
  /** Who won — someone rules on it; nothing is settled automatically. */
  winner: BetSide | null;
  /** When the loser paid up. Only set once there's a winner; cleared by an
      overturn or a rewrite. Bets stored before payouts existed lack it — the
      API normalizes that to null. */
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Soft delete: the page hides a tombstoned bet, but the record stays in
      storage so a delete is recoverable by hand. */
  deletedAt: string | null;
}

/** A bet as the API returns it: plus the storage etag, sent back on edits so
    a stale copy can't overwrite someone else's change. */
export type BetRecord = Bet & { version: string };

/** The editable fields, as a create/edit form submits them. */
export interface BetDraft {
  season: string;
  week: number;
  sideA: string;
  sideB: string;
  terms: string;
}

/** What an edit may change. `deleted` tombstones (true) or restores (false). */
export interface BetPatch {
  week?: number;
  sideA?: string;
  sideB?: string;
  terms?: string;
  winner?: BetSide | null;
  /** Mark the payout made (true) or undo it (false). Needs a winner. */
  paid?: boolean;
  deleted?: boolean;
}
