import type { Matchup, SeasonWeeks } from '@/shared/api/types';

export const SEASON_WEEKS = 17;

/** Fetch all 17 weeks and trim each to {m,r,p}. Any failed week rejects the
    whole load — never swallowed into []: an empty week is indistinguishable
    from a genuinely quiet one, and for a completed season the result is cached
    forever (and persisted), so one Sleeper blip would blank that week for good.
    Rejecting lets the query retry and keeps the bad result out of the cache.
    (A future week Sleeper hasn't scheduled comes back as a successful [], so
    it's unaffected.) */
export async function loadSeasonWeeks(get: (week: number) => Promise<Matchup[]>): Promise<SeasonWeeks> {
  const nums = Array.from({ length: SEASON_WEEKS }, (_, i) => i + 1);
  const all = await Promise.all(nums.map((w) => get(w)));
  const trimmed: SeasonWeeks = {};
  nums.forEach((w, i) => {
    trimmed[w] = (all[i] ?? []).map((m) => ({ m: m.matchup_id, r: m.roster_id, p: m.points || 0 }));
  });
  return trimmed;
}
