import { describe, expect, it } from 'vitest';
import type { Matchup } from '@/shared/api/types';
import { loadSeasonLineups } from './loadSeasonLineups';

describe('loadSeasonLineups', () => {
  it('fetches weeks 1…N and keeps starters plus only the players who scored', async () => {
    const seen: number[] = [];
    const out = await loadSeasonLineups(3, async (w) => {
      seen.push(w);
      return [{ matchup_id: 1, roster_id: 4, starters: ['a', '0'], players: ['a', 'b', 'c'], players_points: { a: 12, b: 0, c: 3 } } as Matchup];
    });
    expect(seen.sort()).toEqual([1, 2, 3]);
    expect(out[2]).toEqual([{ r: 4, s: ['a', '0'], pp: { a: 12, c: 3 } }]);
  });

  it('rejects when any week fails', async () => {
    await expect(loadSeasonLineups(3, async (w) => (w === 2 ? Promise.reject(new Error('502')) : []))).rejects.toThrow('502');
  });
});
