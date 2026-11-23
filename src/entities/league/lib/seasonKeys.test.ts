import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { League } from '@/shared/api/types';
import { qk } from '@/shared/api/queryKeys';
import { staleFor } from './activeLeague';

const live = { league_id: 'L', status: 'in_season' } as League;
const done = { ...live, status: 'complete' } as League;

describe('season-scoped query keys', () => {
  // Codex P1 on #31: a snapshot fetched mid-season must not become the
  // complete season's forever-fresh entry.
  it('a season fetched while live is fetched again once it is complete, then kept', async () => {
    const client = new QueryClient();
    const calls: string[] = [];
    const fetchWeeks = (lg: League, what: string) =>
      client.fetchQuery({ queryKey: qk.weeks(lg), queryFn: async () => (calls.push(what), what), staleTime: staleFor(lg, 60_000) });

    expect(await fetchWeeks(live, 'weeks 1-15 played')).toBe('weeks 1-15 played');
    expect(await fetchWeeks(done, 'all 17 final')).toBe('all 17 final');
    expect(await fetchWeeks(done, 'not fetched again')).toBe('all 17 final');
    expect(calls).toEqual(['weeks 1-15 played', 'all 17 final']);
  });

  it('every season-scoped key carries the phase', () => {
    const keys = [qk.users, qk.rosters, qk.weeks, qk.lineups, qk.moves, qk.draft, qk.brackets, qk.seasonBundle];
    for (const k of keys) expect(k(live)).not.toEqual(k(done));
    expect(qk.liveWeek(live, 3)).not.toEqual(qk.liveWeek(done, 3));
    expect(qk.matchupDetail(live, 3)).not.toEqual(qk.matchupDetail(done, 3));
    expect(qk.stats('2024', live)).not.toEqual(qk.stats('2024', done));
  });
});
