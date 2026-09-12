/**
 * A tiny fake league for the server-side tests: 4 managers, two seasons, a
 * handful of played weeks. The aggregates are built by the real
 * aggregateAllTime / recordBook / h2h so the fixtures exercise the same math
 * the site does — only the Sleeper fetches are faked, never the arithmetic.
 */
import { aggregateAllTime } from '@/features/league-history/model/aggregateAllTime';
import { recordBook } from '@/features/league-history/model/recordBook';
import { h2h } from '@/features/league-history/model/h2h';
import type { SeasonBundle } from '@/features/league-history/model/buildSeasonBundle';
import type { League, TrimmedMatchup } from '@/shared/api/types';
import type { StandingRow } from '@/entities/team/model/types';
import type { Snapshot } from './lib/league';

const PWS = 3; // weeks 1–2 are regular season, 3+ is playoffs

const ROSTER: [number, string, string, string][] = [
  [1, 'a', 'alice', 'Boom Squad'],
  [2, 'b', 'bob', 'Bust Squad'],
  [3, 'c', 'cara', 'Chaos Theory'],
  [4, 'd', 'dan', 'Dust Bowl'],
];

function names(): SeasonBundle['names'] {
  const out: SeasonBundle['names'] = {};
  ROSTER.forEach(([rid, ownerId, owner, team]) => (out[rid] = { team, owner, ownerId, av: '' }));
  return out;
}

function standings(rows: [number, number, number, number, number][]): StandingRow[] {
  return rows
    .map(([rid, w, l, pf, pa]): StandingRow => {
      const [, ownerId, owner, team] = ROSTER.find(([r]) => r === rid)!;
      return { rosterId: rid, ownerId, owner, team, avatar: '', w, l, t: 0, pf, pa, recordStr: `${w}-${l}` };
    })
    .sort((x, y) => y.w - x.w || y.pf - x.pf);
}

/** Two games a week: rosters 1v2 (matchup 1) and 3v4 (matchup 2). */
function week(scores: [number, number, number, number]): TrimmedMatchup[] {
  return [
    { m: 1, r: 1, p: scores[0] },
    { m: 1, r: 2, p: scores[1] },
    { m: 2, r: 3, p: scores[2] },
    { m: 2, r: 4, p: scores[3] },
  ];
}

const EMPTY: TrimmedMatchup[] = [];

function bundle(season: string, status: SeasonBundle['status'], weeks: TrimmedMatchup[][], rows: [number, number, number, number, number][]): SeasonBundle {
  const s = standings(rows);
  return {
    season,
    status,
    names: names(),
    standings: s,
    weeks: Array.from({ length: 17 }, (_, i) => weeks[i] ?? EMPTY),
    champ: status === 'complete' ? (names()[1] ?? null) : null,
    ru: status === 'complete' ? (names()[3] ?? null) : null,
    sacko: s[s.length - 1] ?? null,
    pws: PWS,
  };
}

function league(season: string, status: League['status']): League {
  return {
    league_id: `lg-${season}`,
    previous_league_id: null,
    name: 'M$G Fantasy Football League',
    season,
    status,
    settings: { playoff_week_start: PWS, playoff_teams: 2 },
    scoring_settings: { rec: 1 },
  };
}

export function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  const bundles = [
    // 2024, live: one played week plus a blowout in week 2.
    bundle('2024', 'in_season', [week([120.5, 99.25, 88, 140.75]), week([101, 100.5, 60, 175.25])], [
      [1, 2, 0, 221.5, 199.75],
      [2, 0, 2, 199.75, 221.5],
      [3, 0, 2, 148, 316],
      [4, 2, 0, 316, 148],
    ]),
    // 2023, finished.
    bundle('2023', 'complete', [week([110, 105, 90, 95]), week([130, 80, 99, 99.5])], [
      [1, 2, 0, 240, 185],
      [2, 0, 2, 185, 240],
      [3, 0, 2, 189, 194.5],
      [4, 2, 0, 194.5, 189],
    ]),
  ];

  return {
    chain: [league('2024', 'in_season'), league('2023', 'complete')],
    active: league('2024', 'in_season'),
    current: league('2024', 'in_season'),
    bundles,
    allTime: aggregateAllTime(bundles),
    recs: recordBook(bundles),
    h2h: h2h(bundles),
    nfl: { season: '2024', week: 2, season_type: 'regular' },
    liveWeek: 2,
    ...overrides,
  };
}
