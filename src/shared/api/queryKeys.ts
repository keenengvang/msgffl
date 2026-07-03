import { LEAGUE_ID } from '@/shared/config/constants';

/** Single query-key factory — every useQuery key in the app flows through here. */
export const qk = {
  nflState: ['nfl-state'] as const,
  chain: ['chain', LEAGUE_ID] as const,
  users: (leagueId: string) => ['league', leagueId, 'users'] as const,
  rosters: (leagueId: string) => ['league', leagueId, 'rosters'] as const,
  weeks: (leagueId: string) => ['league', leagueId, 'weeks'] as const,
  draft: (leagueId: string) => ['league', leagueId, 'draft'] as const,
  brackets: (leagueId: string) => ['league', leagueId, 'brackets'] as const,
  seasonBundle: (leagueId: string) => ['league', leagueId, 'season-bundle'] as const,
  stats: (season: string) => ['stats', season] as const,
  players: ['players-trimmed'] as const,
};
