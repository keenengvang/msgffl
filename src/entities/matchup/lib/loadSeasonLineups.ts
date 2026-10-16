import type { Matchup, SeasonLineups } from '@/shared/api/types';

/** Fetch weeks 1…`lastWeek` with full rosters and trim each to its lineup.
    Same contract as loadSeasonWeeks: any failed week rejects the whole load,
    because a missing week would read as a team that started nobody. */
export async function loadSeasonLineups(lastWeek: number, get: (week: number) => Promise<Matchup[]>): Promise<SeasonLineups> {
  const nums = Array.from({ length: Math.max(0, lastWeek) }, (_, i) => i + 1);
  const all = await Promise.all(nums.map((w) => get(w)));
  const out: SeasonLineups = {};
  nums.forEach((w, i) => {
    out[w] = (all[i] ?? []).map((m) => {
      const pp: Record<string, number> = {};
      for (const [id, pts] of Object.entries(m.players_points ?? {})) if (pts) pp[id] = pts;
      return { r: m.roster_id, s: m.starters ?? [], pp };
    });
  });
  return out;
}
