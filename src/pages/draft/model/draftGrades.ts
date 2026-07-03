import type { DraftPick, SeasonStats } from '@/shared/api/types';
import type { PtsKey } from '@/entities/league/lib/ptsKey';
import type { Grade } from '@/shared/config/banter';

export type { Grade };

/** Rank bucket → letter. Rank 0 = best draft class. */
export function gradeFor(i: number): Grade {
  return i === 0 ? 'A+' : i <= 2 ? 'A' : i <= 4 ? 'B+' : i <= 6 ? 'B' : i <= 8 ? 'C+' : i <= 10 ? 'C' : i <= 12 ? 'D' : 'F';
}

export function gradeColor(g: Grade): string {
  return g[0] === 'A' ? 'var(--win)' : g[0] === 'B' ? 'var(--text-body)' : g[0] === 'C' ? 'var(--warn)' : 'var(--loss)';
}

/** Total season pts per roster from its draft class, ranked desc. */
export function rankDraftClasses(picks: DraftPick[], stats: SeasonStats, pk: PtsKey): Array<{ rid: number; total: number }> {
  const byRoster: Record<number, number> = {};
  picks.forEach((p) => {
    const rid = p.roster_id;
    if (!rid) return;
    const pts = stats[p.player_id] ? (stats[p.player_id]?.[pk] ?? 0) : 0;
    byRoster[rid] = (byRoster[rid] ?? 0) + pts;
  });
  return Object.keys(byRoster)
    .map((rid) => ({ rid: Number(rid), total: byRoster[Number(rid)]! }))
    .sort((a, b) => b.total - a.total);
}
