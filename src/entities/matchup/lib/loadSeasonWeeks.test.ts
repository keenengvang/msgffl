import { describe, expect, it } from 'vitest';
import type { Matchup } from '@/shared/api/types';
import { loadSeasonWeeks } from './loadSeasonWeeks';

const row = (r: number, p: number | null): Matchup => ({ matchup_id: 1, roster_id: r, points: p }) as Matchup;

describe('loadSeasonWeeks', () => {
  it('fetches weeks 1–17 and trims each to {m,r,p}', async () => {
    const seen: number[] = [];
    const weeks = await loadSeasonWeeks(async (w) => {
      seen.push(w);
      return w === 3 ? [row(1, 101.5), row(2, null)] : [];
    });
    expect(seen.sort((a, b) => a - b)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
    expect(weeks[3]).toEqual([
      { m: 1, r: 1, p: 101.5 },
      { m: 1, r: 2, p: 0 },
    ]);
    expect(weeks[17]).toEqual([]); // an unscheduled week is a real, successful []
  });

  it('rejects when any single week fails — never caches a failure as an empty week', async () => {
    await expect(
      loadSeasonWeeks(async (w) => {
        if (w === 9) throw new Error('Sleeper 502');
        return [row(1, 100)];
      }),
    ).rejects.toThrow('Sleeper 502');
  });
});
