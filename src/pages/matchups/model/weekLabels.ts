import { liveWeekFor } from '@/entities/matchup/lib/liveWeek';

/** Week pill label: regular weeks are "WK n", playoff weeks get round names. */
export function weekLabel(week: number, playoffWeekStart: number): string {
  const o = week - playoffWeekStart;
  if (week < playoffWeekStart) return `WK ${week}`;
  return o === 0 ? `QF W${week}` : o === 1 ? `SEMI W${week}` : o === 2 ? `SHIP W${week}` : `W${week}`;
}

/** Default selected week: title week for complete seasons, else the live NFL
    week when it belongs to this season, else 1. The rule itself lives in the
    matchup entity — the wire and the dashboard read the same week. */
export const defaultWeek = liveWeekFor;
