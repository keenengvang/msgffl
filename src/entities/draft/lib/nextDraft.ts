import type { Draft } from '@/shared/api/types';

export interface NextDraft {
  season: string;
  /** ms epoch, or null while the commish hasn't scheduled it. */
  startTime: number | null;
}

/** The league's upcoming draft: the newest league's draft while it hasn't
    run; once it's complete the next one is next season's, date unknown
    until Sleeper mints that league. */
export function nextDraftInfo(newestSeason: string | undefined, draft: Draft | null | undefined): NextDraft | null {
  if (!newestSeason) return null;
  if (draft && draft.status !== 'complete') return { season: draft.season, startTime: draft.start_time ?? null };
  return { season: String(Number(newestSeason) + 1), startTime: null };
}
