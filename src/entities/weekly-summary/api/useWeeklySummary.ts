import { useQuery } from '@tanstack/react-query';
import { qk } from '@/shared/api/queryKeys';
import { WEEKLY_SUMMARY_URL } from '@/shared/config/constants';
import type { WeeklySummary } from '../model/types';

function isWeeklySummary(v: unknown): v is WeeklySummary {
  const s = v as Partial<WeeklySummary> | null;
  return !!s && typeof s.headline === 'string' && Array.isArray(s.sections);
}

/** The agent writes this file straight to GitHub — bust GitHub's raw-content CDN cache
    so a fresh weekly run shows up without waiting out its TTL. */
export function useWeeklySummary() {
  return useQuery({
    queryKey: qk.weeklySummary,
    queryFn: async (): Promise<WeeklySummary> => {
      const r = await fetch(`${WEEKLY_SUMMARY_URL}?ts=${Date.now()}`);
      if (!r.ok) throw new Error(`GitHub said no (${r.status})`);
      const body: unknown = await r.json();
      if (!isWeeklySummary(body)) throw new Error('weekly summary file is malformed');
      return body;
    },
    staleTime: 60 * 60 * 1000,
  });
}
