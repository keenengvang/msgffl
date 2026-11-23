import type { Draft, DraftPick } from '@/shared/api/types';

export interface DraftBundle {
  draft: Draft | null;
  picks: DraftPick[];
}

/** The season's draft and, once it is complete, its picks. A failed fetch
    rejects — never swallowed into []: a complete draft is cached forever
    (staleTime Infinity) and persisted, so empty picks would blank the board
    and every grade for good. */
export async function loadDraft(
  drafts: () => Promise<Draft[]>,
  picks: (draftId: string) => Promise<DraftPick[]>,
): Promise<DraftBundle> {
  const draft = (await drafts())[0] ?? null;
  return { draft, picks: draft && draft.status === 'complete' ? await picks(draft.draft_id) : [] };
}
