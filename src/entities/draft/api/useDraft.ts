import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/sleeper';
import { qk } from '@/shared/api/queryKeys';
import type { Draft, DraftPick, League } from '@/shared/api/types';

export interface DraftBundle {
  draft: Draft | null;
  picks: DraftPick[];
}

/** The season's draft and (once complete) its picks, in one query. */
export function useDraft(league: League | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.draft(league?.league_id ?? ''),
    enabled: enabled && !!league,
    queryFn: async (): Promise<DraftBundle> => {
      const ds = await api<Draft[]>(`/league/${league!.league_id}/drafts`).catch(() => [] as Draft[]);
      const draft = ds[0] ?? null;
      let picks: DraftPick[] = [];
      if (draft && draft.status === 'complete') {
        picks = await api<DraftPick[]>(`/draft/${draft.draft_id}/picks`).catch(() => [] as DraftPick[]);
      }
      return { draft, picks };
    },
    // Completed drafts never change; keep polling until then.
    staleTime: (q) => (q.state.data?.draft?.status === 'complete' ? Infinity : 5 * 60_000),
  });
}
