import { describe, expect, it } from 'vitest';
import type { TrimmedMatchup } from '@/shared/api/types';
import { pairMatchups } from './pairMatchups';
import { weekTags } from './weekTags';

const e = (m: number, r: number, p: number): TrimmedMatchup => ({ m, r, p });

describe('pairMatchups', () => {
  it('groups by matchup id and sorts each pair by roster id', () => {
    const pairs = pairMatchups([e(2, 4, 90), e(1, 3, 100), e(1, 1, 120), e(2, 2, 95)]);
    expect(pairs).toHaveLength(2);
    expect(pairs.map((p) => [p[0].r, p[1].r])).toEqual([
      [1, 3],
      [2, 4],
    ]);
  });

  it('drops null matchup ids and incomplete pairs', () => {
    const orphan: TrimmedMatchup = { m: 9, r: 5, p: 50 };
    const nullId: TrimmedMatchup = { m: null, r: 6, p: 60 };
    expect(pairMatchups([orphan, nullId])).toHaveLength(0);
  });
});

describe('weekTags', () => {
  it('tags nuke (top score), blow (max margin), close (min nonzero margin)', () => {
    const pairs = pairMatchups([
      e(1, 1, 150), e(1, 2, 100), // margin 50, top 150
      e(2, 3, 120), e(2, 4, 119), // margin 1, top 120
      e(3, 5, 130), e(3, 6, 60), // margin 70, top 130
    ]);
    const tags = weekTags(pairs);
    expect(tags.nuke).toBe(1);
    expect(tags.blow).toBe(3);
    expect(tags.close).toBe(2);
  });

  it('returns no tags for an unplayed week (all zeros)', () => {
    const pairs = pairMatchups([e(1, 1, 0), e(1, 2, 0)]);
    expect(weekTags(pairs)).toEqual({ nuke: null, blow: null, close: null });
  });
});
