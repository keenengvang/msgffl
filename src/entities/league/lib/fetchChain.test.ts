import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { League, NflState } from '@/shared/api/types';

const old = { league_id: 'L26', season: '2026', status: 'complete' } as League;
const next = { league_id: 'L27', season: '2027', status: 'pre_draft', previous_league_id: 'L26' } as League;
const failing = new Set<string>();
vi.mock('./walkChain', () => ({ walkChain: async () => [old] }));
vi.mock('@/shared/api/sleeper', async (orig) => ({
  ...(await orig<typeof import('@/shared/api/sleeper')>()),
  api: async (path: string) => {
    if ([...failing].some((f) => path.includes(f))) throw new Error(`Sleeper said no (502) on ${path}`);
    if (path === '/league/L26/users') return [{ user_id: 'u1' }, { user_id: 'u2' }];
    if (path.startsWith('/user/')) return [next];
    return [];
  },
}));
const { fetchChain } = await import('./fetchChain');
const ns = { season: '2027' } as NflState;

describe('fetchChain', () => {
  beforeEach(() => failing.clear());

  it("adds the next season from a member's leagues", async () => {
    expect((await fetchChain(ns)).map((l) => l.season)).toEqual(['2027', '2026']);
  });

  it('moves on to the next member when one lookup fails', async () => {
    failing.add('/user/u1/');
    expect((await fetchChain(ns)).map((l) => l.season)).toEqual(['2027', '2026']);
  });

  // The chain is persisted for an hour: a blip that drops the new season
  // would hide it from every page for that hour.
  it('rejects when discovery fails, instead of a chain missing the new season', async () => {
    failing.add('/league/L26/users');
    await expect(fetchChain(ns)).rejects.toThrow('502');
  });

  it('rejects when every member lookup fails', async () => {
    failing.add('/user/');
    await expect(fetchChain(ns)).rejects.toThrow('502');
  });
});
