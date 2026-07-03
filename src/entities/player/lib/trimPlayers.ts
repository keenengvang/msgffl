import type { PlayersDb, RawPlayer } from '@/shared/api/types';
import type { Position } from '@/shared/config/constants';

const KEEP: Record<string, true> = { QB: true, RB: true, WR: true, TE: true, K: true, DEF: true };

/** Shrink the ~5MB /players/nfl payload to the fantasy-relevant slice.
    Keeps QB/RB/WR/TE/K/DEF; non-DEF must be Active. */
export function trimPlayers(raw: Record<string, RawPlayer>): PlayersDb {
  const out: PlayersDb = {};
  for (const id in raw) {
    const p = raw[id];
    if (!p || !p.position || !KEEP[p.position]) continue;
    if (p.position !== 'DEF' && p.status !== 'Active') continue;
    out[id] = {
      n: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
      p: p.position as Position,
      t: p.team || 'FA',
      a: p.age ?? 0,
      x: p.years_exp == null ? -1 : p.years_exp,
    };
  }
  return out;
}
