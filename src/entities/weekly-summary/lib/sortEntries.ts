import type { WeeklySummaryIndexEntry } from '../model/types';

/** Newest first — don't trust the manifest's own order, the agent maintains it by hand. */
export function sortWeeklySummaryEntries(entries: WeeklySummaryIndexEntry[]): WeeklySummaryIndexEntry[] {
  return [...entries].sort((a, b) => Number(b.season) - Number(a.season) || b.week - a.week);
}
