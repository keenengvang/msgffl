import type { BracketGame } from '@/shared/api/types';

export interface Brackets {
  winners: BracketGame[];
  losers: BracketGame[];
}

/** Both playoff brackets. A failed fetch rejects — never swallowed into []:
    a complete season's brackets are cached forever and persisted, and an
    empty winners bracket means "no champion" on every page that names one.
    Rejecting lets the query retry and keeps the failure out of the cache. */
export async function loadBrackets(get: (side: 'winners' | 'losers') => Promise<BracketGame[] | null>): Promise<Brackets> {
  const [winners, losers] = await Promise.all([get('winners'), get('losers')]);
  return { winners: winners ?? [], losers: losers ?? [] };
}
