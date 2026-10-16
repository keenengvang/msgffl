import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/sleeper';
import { qk } from '@/shared/api/queryKeys';
import type { RawPlayer } from '@/shared/api/types';
import { indexPlayers } from '../lib/indexPlayers';

const WEEK_MS = 7 * 864e5;

/** Name + fantasy position for every player, any status (~130KB) — for
    history: who started in a lineup two seasons ago. Same trim-inside-the-
    queryFn rule as usePlayersDb: the raw ~5MB never enters the cache. */
export function usePlayerIndex(enabled = true) {
  return useQuery({
    queryKey: qk.playerIndex,
    enabled,
    queryFn: async () => indexPlayers(await api<Record<string, RawPlayer>>('/players/nfl')),
    staleTime: WEEK_MS,
    gcTime: WEEK_MS + 864e5,
  });
}
