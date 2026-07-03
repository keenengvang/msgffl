import type { DraftPick, SeasonStats } from '@/shared/api/types';
import type { PtsKey } from '@/entities/league/lib/ptsKey';

export type Grade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';

/** Rank bucket → letter. Rank 0 = best draft class. */
export function gradeFor(i: number): Grade {
  return i === 0 ? 'A+' : i <= 2 ? 'A' : i <= 4 ? 'B+' : i <= 6 ? 'B' : i <= 8 ? 'C+' : i <= 10 ? 'C' : i <= 12 ? 'D' : 'F';
}

export const GRADE_BLURBS: Record<'savage' | 'polite', Record<Grade, string>> = {
  savage: {
    'A+': 'Robbery in broad daylight.',
    A: 'The war room cooked.',
    'B+': 'Solid. Boring, but solid.',
    B: 'Fine. Perfectly fine. Whatever.',
    'C+': 'Reached a little. We noticed.',
    C: 'Drafted with vibes, not rankings.',
    D: 'The autodraft did some of this.',
    F: 'Punishment speedrun, draft edition.',
  },
  polite: {
    'A+': 'Exceptional value all draft long.',
    A: 'A very strong board.',
    'B+': 'Above average work.',
    B: 'A steady, sensible draft.',
    'C+': 'A few reaches in there.',
    C: 'Room to improve next year.',
    D: 'A tough draft day.',
    F: 'It gets better from here.',
  },
};

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
