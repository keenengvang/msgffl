import { LEAGUE_ID } from '@/shared/config/constants';

/** Single query-key factory — every useQuery key in the app flows through here. */
export const qk = {
  nflState: ['nfl-state'] as const,
  chain: ['chain', LEAGUE_ID] as const,
  users: (leagueId: string) => ['league', leagueId, 'users'] as const,
  rosters: (leagueId: string) => ['league', leagueId, 'rosters'] as const,
  weeks: (leagueId: string) => ['league', leagueId, 'weeks'] as const,
  /** The single in-progress week, polled apart from the 17-week bundle. */
  liveWeek: (leagueId: string, week: number) => ['league', leagueId, 'live-week', week] as const,
  /** One week's matchups with full roster detail — separate from `weeks`
      since that one is deliberately trimmed. */
  matchupDetail: (leagueId: string, week: number) => ['league', leagueId, 'matchup-detail', week] as const,
  draft: (leagueId: string) => ['league', leagueId, 'draft'] as const,
  brackets: (leagueId: string) => ['league', leagueId, 'brackets'] as const,
  seasonBundle: (leagueId: string) => ['league', leagueId, 'season-bundle'] as const,
  stats: (season: string) => ['stats', season] as const,
  players: ['players-trimmed'] as const,
  weeklySummaryIndex: ['weekly-summary', 'index'] as const,
  weeklySummary: (file: string) => ['weekly-summary', file] as const,
};
