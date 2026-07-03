import type { BracketGame } from '@/shared/api/types';

export interface TitleResult {
  /** Roster id of the champion (winner of the p=1 game). */
  champRoster: number | null;
  /** Roster id of the runner-up. */
  ruRoster: number | null;
}

/** The finals game is the winners-bracket game that decides place 1. */
export function titleGame(winners: BracketGame[] | undefined): TitleResult {
  const fin = (winners ?? []).find((g) => g.p === 1);
  return {
    champRoster: fin && typeof fin.w === 'number' ? fin.w : null,
    ruRoster: fin && typeof fin.l === 'number' ? fin.l : null,
  };
}
