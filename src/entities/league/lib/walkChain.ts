import { api } from '@/shared/api/sleeper';
import type { League } from '@/shared/api/types';

/** Follow previous_league_id back through history. Returns newest-first. */
export async function walkChain(startId: string): Promise<League[]> {
  const chain: League[] = [];
  let id: string | null = startId;
  while (id && id !== '0' && chain.length < 20) {
    const lg: League = await api<League>(`/league/${id}`);
    chain.push(lg);
    id = lg.previous_league_id;
  }
  return chain;
}
