import type { Transaction } from '@/shared/api/types';
import { trimMoves, type Move } from './moves';

/** Sleeper files transactions by leg: 17 game weeks plus the offseason leg. */
export const TX_LEGS = 18;

/** One season's moves. Any failed leg rejects the load — a missing week of
    claims looks exactly like a quiet one, and FAAB totals built on it would be
    wrong while looking authoritative. */
export async function loadSeasonMoves(season: string, get: (leg: number) => Promise<Transaction[]>): Promise<Move[]> {
  const legs = await Promise.all(Array.from({ length: TX_LEGS }, (_, i) => get(i + 1)));
  return trimMoves(legs.flat(), season);
}
