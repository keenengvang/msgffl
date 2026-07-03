/** Week pill label: regular weeks are "WK n", playoff weeks get round names. */
export function weekLabel(week: number, playoffWeekStart: number): string {
  const o = week - playoffWeekStart;
  if (week < playoffWeekStart) return `WK ${week}`;
  return o === 0 ? `QF W${week}` : o === 1 ? `SEMI W${week}` : o === 2 ? `SHIP W${week}` : `W${week}`;
}

/** Default selected week: title week for complete seasons, else the live NFL
    week when it belongs to this season, else 1. */
export function defaultWeek(input: {
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
