import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { League } from '@/shared/api/types';

// Every Sleeper path the bundle reads, answered from this table; a path in
// `failing` rejects the way api() does on a non-2xx.
const failing = new Set<string>();
vi.mock('@/shared/api/sleeper', async (orig) => ({
  ...(await orig<typeof import('@/shared/api/sleeper')>()),
  api: async (path: string) => {
    if (failing.has(path)) throw new Error(`Sleeper said no (502) on ${path}`);
    if (path.endsWith('/users')) return [{ user_id: 'u1', display_name: 'A' }, { user_id: 'u2', display_name: 'B' }];
    if (path.endsWith('/rosters'))
      return [
        { roster_id: 1, owner_id: 'u1', settings: { wins: 10, losses: 4, ties: 0, fpts: 1500 } },
        { roster_id: 2, owner_id: 'u2', settings: { wins: 4, losses: 10, ties: 0, fpts: 1200 } },
      ];
    if (path.endsWith('/winners_bracket')) return [{ r: 1, m: 1, t1: 1, t2: 2, w: 2, l: 1, p: 1 }];
    return [];
  },
}));

const { buildSeasonBundle } = await import('./buildSeasonBundle');
const lg = { league_id: 'L', season: '2024', status: 'complete', settings: { playoff_week_start: 15 } } as unknown as League;

describe('buildSeasonBundle', () => {
  beforeEach(() => failing.clear());

  it('takes the champion from the winners bracket', async () => {
    const b = await buildSeasonBundle(lg);
    expect(b.champ?.ownerId).toBe('u2');
  });

  // A complete season's bundle is cached with staleTime Infinity and persisted,
  // so a blip that resolves to [] wipes the champion off the trophy wall for good.
  it('rejects when the winners bracket fails, instead of a bundle with no champion', async () => {
    failing.add('/league/L/winners_bracket');
    await expect(buildSeasonBundle(lg)).rejects.toThrow('winners_bracket');
  });

  it('rejects when any week fails, instead of a bundle with a blank week', async () => {
    failing.add('/league/L/matchups/9');
    await expect(buildSeasonBundle(lg)).rejects.toThrow('matchups/9');
  });
});
