import { describe, expect, it } from 'vitest';
import type { DraftPick, SeasonStats } from '@/shared/api/types';
import { gradeFor, rankDraftClasses } from './draftGrades';

describe('gradeFor', () => {
  it('maps rank buckets to letters across all 14 slots', () => {
    const grades = Array.from({ length: 14 }, (_, i) => gradeFor(i));
    expect(grades).toEqual(['A+', 'A', 'A', 'B+', 'B+', 'B', 'B', 'C+', 'C+', 'C', 'C', 'D', 'D', 'F']);
  });
});

describe('rankDraftClasses', () => {
  it('sums drafted players season pts per roster, ranked desc', () => {
    const pick = (rid: number, pid: string, no: number): DraftPick => ({
      player_id: pid,
      roster_id: rid,
      picked_by: `u${rid}`,
      round: 1,
      pick_no: no,
      draft_slot: rid,
    });
    const stats: SeasonStats = {
      p1: { pts_ppr: 300 },
      p2: { pts_ppr: 100 },
      p3: { pts_half_ppr: 500 }, // wrong scoring key — counts as 0 under pts_ppr
    };
    const ranked = rankDraftClasses([pick(1, 'p1', 1), pick(2, 'p2', 2), pick(2, 'p3', 3)], stats, 'pts_ppr');
    expect(ranked).toEqual([
      { rid: 1, total: 300 },
      { rid: 2, total: 100 },
    ]);
  });
});
