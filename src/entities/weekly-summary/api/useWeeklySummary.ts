import { useQuery } from '@tanstack/react-query';
import { qk } from '@/shared/api/queryKeys';
import { WEEKLY_SUMMARY_BASE_URL } from '@/shared/config/constants';
import type { WeeklySummary, WeeklySummarySection } from '../model/types';

function isSection(v: unknown): v is WeeklySummarySection {
  const s = v as Partial<WeeklySummarySection> | null;
  return !!s && typeof s.heading === 'string' && typeof s.body === 'string';
}

function isWeeklySummary(v: unknown): v is WeeklySummary {
  const s = v as Partial<WeeklySummary> | null;
  return (
    !!s &&
    typeof s.season === 'string' &&
    typeof s.week === 'number' &&
    typeof s.generatedAt === 'string' &&
    typeof s.headline === 'string' &&
    Array.isArray(s.sections) &&
    s.sections.every(isSection)
  );
}

/** One week's full recap, e.g. `file: "2026-w01.json"` from the index manifest. */
export function useWeeklySummary(file: string | undefined) {
  return useQuery({
    queryKey: qk.weeklySummary(file ?? ''),
    queryFn: async (): Promise<WeeklySummary> => {
      const r = await fetch(`${WEEKLY_SUMMARY_BASE_URL}/${file}?ts=${Date.now()}`);
      if (!r.ok) throw new Error(`GitHub said no (${r.status})`);
      const body: unknown = await r.json();
      if (!isWeeklySummary(body)) throw new Error('weekly summary file is malformed');
      return body;
    },
    // Short: a new recap lands mid-session on filing day, and this is never persisted.
    staleTime: 5 * 60 * 1000,
    enabled: !!file,
  });
}
