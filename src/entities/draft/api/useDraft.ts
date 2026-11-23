import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/sleeper';
import { qk } from '@/shared/api/queryKeys';
import type { Draft, DraftPick, League } from '@/shared/api/types';
import { loadDraft, type DraftBundle } from '../lib/loadDraft';

export type { DraftBundle };

/** The season's draft and (once complete) its picks, in one query. */
export function useDraft(league: League | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.draft(league),
    enabled: enabled && !!league,
    queryFn: () =>
      loadDraft(
        () => api<Draft[]>(`/league/${league!.league_id}/drafts`),
        (id) => api<DraftPick[]>(`/draft/${id}/picks`),
      ),
    // Completed drafts never change; keep polling until then.
    staleTime: (q) => (q.state.data?.draft?.status === 'complete' ? Infinity : 5 * 60_000),
  });
}
