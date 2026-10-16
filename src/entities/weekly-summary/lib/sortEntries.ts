import type { WeeklySummaryIndexEntry } from '../model/types';

/** Real recaps only (weeks 1+ — a week-0 template never reaches the page),
    newest first. Don't trust the manifest's own order; the agent maintains it by hand. */
export function sortWeeklySummaryEntries(entries: WeeklySummaryIndexEntry[]): WeeklySummaryIndexEntry[] {
  return entries.filter((e) => e.week >= 1).sort((a, b) => Number(b.season) - Number(a.season) || b.week - a.week);
}
