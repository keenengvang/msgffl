import type { PlayerIndex, RawPlayer } from '@/shared/api/types';
import type { Position } from '@/shared/config/constants';

const FANTASY: readonly string[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

/** Name and fantasy position for every player who could ever have filled a
    lineup slot, whatever his status today. The active-only players DB is right
    for "who can I add" and wrong for last season: ~7% of a season's points
    belong to players since marked Inactive (cut, retired, unsigned), and a few
    are listed at their NFL position (DB) while eligible at WR. */
export function indexPlayers(raw: Record<string, RawPlayer>): PlayerIndex {
  const out: PlayerIndex = {};
  for (const id in raw) {
    const p = raw[id];
    if (!p) continue;
    const pos = FANTASY.includes(p.position ?? '') ? p.position : p.fantasy_positions?.find((f) => FANTASY.includes(f));
    if (!pos) continue;
    out[id] = { n: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || id, p: pos as Position };
  }
  return out;
}
