import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { qk } from '@/shared/api/queryKeys';
import { useLeagueChain } from '@/entities/league/api/useLeagueChain';
import { buildSeasonBundle, type SeasonBundle } from '../model/buildSeasonBundle';
import { aggregateAllTime } from '../model/aggregateAllTime';
import { recordBook } from '../model/recordBook';
import { h2h } from '../model/h2h';

/** Every season's bundle + derived aggregates. Bundles for completed seasons
    are immutable (staleTime Infinity) and survive reloads via the persister;
    the aggregates are recomputed in useMemo, never cached. */
export function useSeasonBundles() {
  const chain = useLeagueChain();
  const combined = useQueries({
    queries: (chain.data ?? []).map((lg) => ({
      queryKey: qk.seasonBundle(lg.league_id),
      queryFn: () => buildSeasonBundle(lg),
      staleTime: lg.status === 'complete' ? Infinity : 10 * 60_000,
    })),
    // combine gives a structurally-shared, referentially-stable result
    combine: (results) => ({
      bundles:
        results.length > 0 && results.every((r) => r.data)
          ? results.map((r) => r.data as SeasonBundle)
          : undefined,
      isFetching: results.some((r) => r.isLoading),
      error: results.find((r) => r.error)?.error,
    }),
  });

  const { bundles } = combined;
  const derived = useMemo(() => {
    if (!bundles) return undefined;
    return { ...aggregateAllTime(bundles), recs: recordBook(bundles), h2h: h2h(bundles) };
  }, [bundles]);

  return {
    bundles,
    derived,
    isLoading: chain.isLoading || (!bundles && combined.isFetching),
    error: chain.error ?? combined.error,
  };
}
