import type { TrimmedMatchup } from '@/shared/api/types';
import { pairMatchups } from './pairMatchups';

/** The week a season is "on": the title week once it's over, the live NFL week
    while it's running, else week 1. Shared by /matchups, the dashboard and the
    league wire so all three agree on what "this week" means. */
export function liveWeekFor(input: {
  status: string | undefined;
  playoffWeekStart: number;
  nflSeason: string | undefined;
  nflWeek: number | undefined;
  season: string | undefined;
}): number {
  if (input.status === 'complete') return Math.min(input.playoffWeekStart + 2, 17);
  if (input.nflSeason && input.season === input.nflSeason && input.nflWeek) return input.nflWeek;
  return 1;
}

export interface WeekPulse {
  /** Games scheduled that week. */
  games: number;
  /** Games with points on the board — Sleeper scores live, so this climbs mid-week. */
  scored: number;
  top: { rosterId: number; points: number } | null;
  closest: { winner: number; loser: number; margin: number } | null;
}

/** What's happening in one week, right now. Roster season totals lag behind
    (Sleeper only rolls them up after the week closes), so live copy reads the
    week's matchups instead of standings — otherwise a live week shows 0.00. */
export function weekPulse(list: TrimmedMatchup[] | undefined): WeekPulse {
  const pulse: WeekPulse = { games: 0, scored: 0, top: null, closest: null };
  const pairs = pairMatchups(list ?? []);
  pulse.games = pairs.length;

  pairs.forEach(([a, b]) => {
    if ((a.p || 0) <= 0 && (b.p || 0) <= 0) return;
    pulse.scored += 1;

    const [hi, lo] = a.p >= b.p ? [a, b] : [b, a];
    if (!pulse.top || hi.p > pulse.top.points) pulse.top = { rosterId: hi.r, points: hi.p };

    const margin = hi.p - lo.p;
    // Both sides must be on the board. A margin of 0 means nobody has played;
    // a side still at 0 while the other scores means only one of them has
    // kicked off, and calling that the week's tightest game (5–0 beating a real
    // 20–10) advertises a winner in a game that hasn't happened.
    if (lo.p > 0 && margin > 0 && (!pulse.closest || margin < pulse.closest.margin)) {
      pulse.closest = { winner: hi.r, loser: lo.r, margin };
    }
  });

  return pulse;
}
