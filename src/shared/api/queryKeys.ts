import { LEAGUE_ID } from '@/shared/config/constants';
import type { League } from './types';

/** What a season-scoped key needs: the league, and whether its season is over. */
export type LeagueRef = Pick<League, 'league_id' | 'status'> | undefined;

/** A season fetched while it was live and the same season fetched once it is
    complete are different cache entries, and only the second may be kept
    forever (staleFor). Without the phase in the key, a live snapshot inherits
    staleTime Infinity the moment the league completes and is never fetched
    again: a returning visitor keeps the unplayed playoff weeks for good. */
export const phase = (lg: LeagueRef) => (lg?.status === 'complete' ? 'final' : 'live');
const season = (lg: LeagueRef) => ['league', lg?.league_id ?? '', phase(lg)] as const;

/** Single query-key factory — every useQuery key in the app flows through here. */
export const qk = {
  nflState: ['nfl-state'] as const,
  chain: ['chain', LEAGUE_ID] as const,
  users: (lg: LeagueRef) => [...season(lg), 'users'] as const,
  rosters: (lg: LeagueRef) => [...season(lg), 'rosters'] as const,
  weeks: (lg: LeagueRef) => [...season(lg), 'weeks'] as const,
  /** The single in-progress week, polled apart from the 17-week bundle. */
  liveWeek: (lg: LeagueRef, week: number) => [...season(lg), 'live-week', week] as const,
  /** One week's matchups with full roster detail — separate from `weeks`
      since that one is deliberately trimmed. */
  matchupDetail: (lg: LeagueRef, week: number) => [...season(lg), 'matchup-detail', week] as const,
  /** Every regular-season week's starters + per-player points, for the
      bench and position analytics. Separate from `weeks`, which stays tiny. */
  lineups: (lg: LeagueRef) => [...season(lg), 'lineups'] as const,
  /** The season's waiver claims, free-agent adds and trades, trimmed. */
  moves: (lg: LeagueRef) => [...season(lg), 'moves'] as const,
  draft: (lg: LeagueRef) => [...season(lg), 'draft'] as const,
  brackets: (lg: LeagueRef) => [...season(lg), 'brackets'] as const,
  seasonBundle: (lg: LeagueRef) => [...season(lg), 'season-bundle'] as const,
  stats: (season: string, lg: LeagueRef) => ['stats', season, phase(lg)] as const,
  players: ['players-trimmed'] as const,
  /** Name + fantasy position for every player regardless of status. */
  playerIndex: ['player-index'] as const,
  weeklySummaryIndex: ['weekly-summary', 'index'] as const,
  weeklySummary: (file: string) => ['weekly-summary', file] as const,
  /** Betting board — our own data (Netlify Blobs), not Sleeper's. Never persisted. */
  bets: (season: string) => ['bets', season] as const,
};
