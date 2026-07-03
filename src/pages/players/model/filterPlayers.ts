import type { PlayersDb, SeasonStats } from '@/shared/api/types';
import type { PtsKey } from '@/entities/league/lib/ptsKey';

export interface PlayerRowData {
  pid: string;
  n: string;
  p: string;
  t: string;
  pts: number;
  gp: number;
}

/** Filter + sort the trimmed player DB by pos/query, points desc. */
export function filterPlayers(
  db: PlayersDb,
  stats: SeasonStats,
  pk: PtsKey,
  pos: string,
  q: string,
): PlayerRowData[] {
  const needle = q.trim().toLowerCase();
  let list = Object.keys(db).map((pid) => {
    const p = db[pid]!;
    const s = stats[pid];
    return { pid, n: p.n, p: p.p, t: p.t, pts: s ? (s[pk] ?? 0) : 0, gp: s ? (s.gp ?? 0) : 0 };
  });
  if (pos !== 'ALL') list = list.filter((p) => p.p === pos);
  if (needle) list = list.filter((p) => p.n.toLowerCase().includes(needle) || p.t.toLowerCase().includes(needle));
  list.sort((a, b) => b.pts - a.pts);
  return list;
}
