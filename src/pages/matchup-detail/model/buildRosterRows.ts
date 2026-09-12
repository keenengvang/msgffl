import type { Matchup, PlayersDb, TrimmedPlayer } from '@/shared/api/types';
import type { Position } from '@/shared/config/constants';

export interface RosterRow {
  pid: string;
  name: string;
  pos: Position;
  team: string;
  pts: number | null;
  starter: boolean;
}

/** One side's roster for the matchup detail view: starters first, in the
    lineup-slot order Sleeper's own `starters` array already carries, then
    the bench sorted by points scored. Sleeper pads an empty slot with the
    literal id "0" — drop those rather than rendering a phantom player. */
export function buildRosterRows(matchup: Matchup | undefined, playersDb: PlayersDb | undefined): RosterRow[] {
  if (!matchup || !playersDb) return [];
  const starterIds = (matchup.starters ?? []).filter((id) => id && id !== '0');
  const starterSet = new Set(starterIds);
  const benchIds = (matchup.players ?? []).filter((id) => id && id !== '0' && !starterSet.has(id));
  const pointsFor = matchup.players_points ?? {};

  const toRow = (pid: string): RosterRow => {
    const p: TrimmedPlayer = playersDb[pid] ?? { n: `Player #${pid}`, p: '?' as Position, t: '?', a: 0, x: -1 };
    return { pid, name: p.n, pos: p.p, team: p.t, pts: pointsFor[pid] ?? null, starter: starterSet.has(pid) };
  };

  const bench = benchIds.map(toRow).sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0));
  return [...starterIds.map(toRow), ...bench];
}
