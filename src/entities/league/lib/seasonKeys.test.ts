import { QueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { League } from '@/shared/api/types';

// Run the hooks' own useQuery options (key, queryFn, staleTime, enabled) through
// a real QueryClient: the bug lived at the call sites, in which key each hook
// built from its league, so the test has to go through the hooks.
let captured: UseQueryOptions[] = [];
vi.mock('@tanstack/react-query', async (orig) => ({
  ...(await orig<typeof import('@tanstack/react-query')>()),
  useQuery: (o: UseQueryOptions) => (captured.push(o), {}),
}));
const fetched: string[] = [];
vi.mock('@/shared/api/sleeper', async (orig) => ({
  ...(await orig<typeof import('@/shared/api/sleeper')>()),
  api: async (path: string) => (fetched.push(path), []),
}));

const { useSeasonWeeks } = await import('@/entities/matchup/api/useSeasonWeeks');
const { useSeasonStats } = await import('@/entities/player/api/useSeasonStats');

const live = { league_id: 'L', season: '2024', status: 'in_season' } as League;
const done = { ...live, status: 'complete' } as League;
const optionsOf = (call: () => void) => {
  captured = [];
  call();
  return captured[0]!;
};
const run = (client: QueryClient, o: UseQueryOptions) =>
  client.fetchQuery({ queryKey: o.queryKey, queryFn: o.queryFn as () => Promise<unknown>, staleTime: o.staleTime as number });

describe('season-scoped queries across a season completing', () => {
  // Codex P1 on #31: a snapshot fetched mid-season must not become the
  // complete season's forever-fresh entry.
  it('useSeasonWeeks fetches again once the league is complete, then keeps it', async () => {
    const client = new QueryClient();
    fetched.length = 0;
    await run(client, optionsOf(() => useSeasonWeeks(live)));
    expect(fetched).toHaveLength(17);
    await run(client, optionsOf(() => useSeasonWeeks(done)));
    expect(fetched).toHaveLength(34); // the complete season was fetched, not served from the live snapshot
    await run(client, optionsOf(() => useSeasonWeeks(done)));
    expect(fetched).toHaveLength(34); // and is then kept
  });

  it('useSeasonStats waits for the league, so a cold load fetches once, under the final key', () => {
    const before = optionsOf(() => useSeasonStats('2024', undefined));
    expect(before.enabled).toBe(false);
    const after = optionsOf(() => useSeasonStats('2024', done));
    expect(after.enabled).toBe(true);
    expect(after.staleTime).toBe(Infinity);
  });
});
