export type StandingBadge = 'CHAMPION' | 'PLAYOFFS' | 'SACKO' | null;

interface BadgeInput {
  /** Row index in the sorted standings (0 = first). */
  index: number;
  teamCount: number;
  playoffTeams: number;
  seasonComplete: boolean;
  /** True when this row's roster won the title game. */
  isChampion: boolean;
}

/** Champion beats everything; sacko requires the season to be over. */
export function standingBadge({ index, teamCount, playoffTeams, seasonComplete, isChampion }: BadgeInput): StandingBadge {
  if (isChampion) return 'CHAMPION';
  if (seasonComplete && index === teamCount - 1) return 'SACKO';
  if (index < playoffTeams) return 'PLAYOFFS';
  return null;
}
