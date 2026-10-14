/** A side bet between two managers. Stored server-side (Netlify Blobs, one key
    per bet) — see netlify/functions/bets.ts. Sides are Sleeper owner_ids, which
    are stable across seasons; roster_ids are not. */
export type BetSide = 'A' | 'B';

export type BetTerms =
  /** Higher score that week wins — settled automatically from Sleeper. Works
      whether or not the two actually play each other. */
  | { kind: 'matchup' }
  /** Anything else ("first to bench a 0"). Someone has to rule on it. */
  | { kind: 'custom'; text: string };

export interface Bet {
  id: string;
  season: string;
  week: number;
  sideA: string;
  sideB: string;
  /** The roster each side managed that season, captured when the side was
      set. Scores resolve by roster, so a team changing owners later doesn't
      orphan a decided bet. null → fall back to the current owner mapping. */
  rosterA: number | null;
  rosterB: number | null;
  /** Free text: "a keg", "$20", "wears a Cowboys jersey to work". */
  stakes: string;
  terms: BetTerms;
  /** Manual ruling — custom bets only. A matchup bet's winner is derived from
      the scores and never stored. */
  winner: BetSide | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  /** Soft delete: a tombstoned bet stays visible (and restorable) so nobody
      quietly erases the keg they lost. */
  deletedAt: string | null;
  deletedBy: string | null;
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
  stakes: string;
  terms: BetTerms;
}

/** What an edit may change. `deleted` tombstones (true) or restores (false). */
export interface BetPatch {
  week?: number;
  sideA?: string;
  sideB?: string;
  stakes?: string;
  terms?: BetTerms;
  winner?: BetSide | null;
  deleted?: boolean;
}
