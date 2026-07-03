import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/sleeper';
import { qk } from '@/shared/api/queryKeys';
import type { RawPlayer } from '@/shared/api/types';
import { trimPlayers } from '../lib/trimPlayers';

const WEEK_MS = 7 * 864e5;

/** Trimmed player DB. The raw ~5MB payload is trimmed INSIDE the queryFn so
    it never enters the query cache or the localStorage persister. */
export function usePlayersDb(enabled = true) {
  return useQuery({
    queryKey: qk.players,
    enabled,
    queryFn: async () => trimPlayers(await api<Record<string, RawPlayer>>('/players/nfl')),
    staleTime: WEEK_MS,
    gcTime: WEEK_MS + 864e5,
  });
}
