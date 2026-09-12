import type { WeeklySummaryIndexEntry } from '@/entities/weekly-summary/model/types';

export interface SeasonGroup {
  season: string;
  weeks: WeeklySummaryIndexEntry[];
}

/** Entries are already newest-first; group without re-sorting so season order is preserved. */
export function groupBySeason(entries: WeeklySummaryIndexEntry[]): SeasonGroup[] {
  const groups: SeasonGroup[] = [];
  for (const e of entries) {
    const g = groups.find((x) => x.season === e.season);
    if (g) g.weeks.push(e);
    else groups.push({ season: e.season, weeks: [e] });
  }
  return groups;
}
