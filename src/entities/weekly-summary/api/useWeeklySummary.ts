import { useQuery } from '@tanstack/react-query';
import { qk } from '@/shared/api/queryKeys';
import { WEEKLY_SUMMARY_BASE_URL } from '@/shared/config/constants';
import type { WeeklySummary } from '../model/types';

function isWeeklySummary(v: unknown): v is WeeklySummary {
  const s = v as Partial<WeeklySummary> | null;
  return !!s && typeof s.headline === 'string' && Array.isArray(s.sections);
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
    staleTime: 60 * 60 * 1000,
    enabled: !!file,
  });
}
