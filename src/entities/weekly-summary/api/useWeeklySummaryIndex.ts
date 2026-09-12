import { useQuery } from '@tanstack/react-query';
import { qk } from '@/shared/api/queryKeys';
import { WEEKLY_SUMMARY_INDEX_URL } from '@/shared/config/constants';
import { sortWeeklySummaryEntries } from '../lib/sortEntries';
import type { WeeklySummaryIndex, WeeklySummaryIndexEntry } from '../model/types';

function isIndexEntry(v: unknown): v is WeeklySummaryIndexEntry {
  const e = v as Partial<WeeklySummaryIndexEntry> | null;
  return (
    !!e &&
    typeof e.season === 'string' &&
    typeof e.week === 'number' &&
    typeof e.generatedAt === 'string' &&
    typeof e.headline === 'string' &&
    typeof e.file === 'string'
  );
}

function isWeeklySummaryIndex(v: unknown): v is WeeklySummaryIndex {
  const i = v as Partial<WeeklySummaryIndex> | null;
  return !!i && Array.isArray(i.weeks) && i.weeks.every(isIndexEntry);
}

/** The manifest of every weekly recap ever filed — one entry per week, across seasons.
    The agent prepends to this file each run; we re-sort defensively either way. */
export function useWeeklySummaryIndex() {
  return useQuery({
    queryKey: qk.weeklySummaryIndex,
    queryFn: async (): Promise<WeeklySummaryIndexEntry[]> => {
      const r = await fetch(`${WEEKLY_SUMMARY_INDEX_URL}?ts=${Date.now()}`);
      if (!r.ok) throw new Error(`GitHub said no (${r.status})`);
      const body: unknown = await r.json();
      if (!isWeeklySummaryIndex(body)) throw new Error('weekly summary index is malformed');
      return sortWeeklySummaryEntries(body.weeks);
    },
    // Short: a new recap lands mid-session on filing day, and this is never persisted.
    staleTime: 5 * 60 * 1000,
  });
}
