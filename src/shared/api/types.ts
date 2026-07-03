// Raw Sleeper API wire types (only the fields this app reads).
// Kept in shared/ so entities never need to import each other's types.

import type { Position } from '@/shared/config/constants';

export interface NflState {
  season: string;
  week: number;
  season_type: string;
  season_start_date?: string;
}

export type LeagueStatus = 'pre_draft' | 'drafting' | 'in_season' | 'complete';

export interface League {
  league_id: string;
  previous_league_id: string | null;
  name: string;
  season: string;
  status: LeagueStatus;
  settings?: {
    playoff_week_start?: number;
    playoff_teams?: number;
    [key: string]: number | undefined;
  };
  scoring_settings?: Record<string, number>;
  roster_positions?: string[];
}

export interface LeagueUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata?: { team_name?: string };
}

export interface Roster {
  roster_id: number;
  owner_id: string;
  players?: string[] | null;
  starters?: string[] | null;
  settings?: {
    wins?: number;
    losses?: number;
    ties?: number;
    fpts?: number;
    fpts_decimal?: number;
    fpts_against?: number;
    fpts_against_decimal?: number;
  };
  metadata?: { record?: string };
}

export interface Matchup {
  matchup_id: number | null;
  roster_id: number;
  points?: number;
}

export interface Draft {
  draft_id: string;
  status: string;
  season: string;
  settings?: { rounds?: number };
  draft_order?: Record<string, number> | null;
}

export interface DraftPick {
  player_id: string;
  roster_id: number;
  picked_by: string;
  round: number;
  pick_no: number;
  /** Snake column (1..N): the drafting manager's slot in the draft order. */
  draft_slot: number;
  metadata?: {
    first_name?: string;
    last_name?: string;
    position?: string;
    team?: string;
  };
}

export interface BracketGame {
  r: number; // round
  m: number; // game id
  p?: number; // placing decided by this game (1 = title)
  t1?: number | { w?: number; l?: number } | null;
  t2?: number | { w?: number; l?: number } | null;
  w?: number | null;
  l?: number | null;
  t1_from?: { w?: number; l?: number };
  t2_from?: { w?: number; l?: number };
}

export interface RawPlayer {
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string | null;
  age?: number;
  years_exp?: number | null;
  status?: string;
}

/** Compact player record kept in cache: name, position, team, age, years_exp. */
export interface TrimmedPlayer {
  n: string;
  p: Position;
  t: string;
  a: number;
  x: number;
}

export type PlayersDb = Record<string, TrimmedPlayer>;

/** Per-player season stat line, keyed by stat name (pts_ppr, pts_half_ppr, …). */
export type SeasonStats = Record<string, Record<string, number>>;

/** One week's matchups trimmed to {matchup_id, roster_id, points}. */
export interface TrimmedMatchup {
  m: number | null;
  r: number;
  p: number;
}

/** Weeks 1–17 keyed by week number. */
export type SeasonWeeks = Record<number, TrimmedMatchup[]>;
