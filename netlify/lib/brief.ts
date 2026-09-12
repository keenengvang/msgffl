/**
 * The league brief: everything the analyst should know without asking.
 *
 * Rendered into the system prompt on every turn, so most questions ("who's
 * first?", "who won in 2024?", "what's the highest week ever?") are answered
 * with zero tool calls — which is what keeps the function inside Netlify's
 * synchronous timeout. The tools in tools.ts cover the long tail this can't:
 * one team in depth, an arbitrary week, a specific rivalry, player lookups.
 *
 * Plain text, not JSON — it costs fewer tokens and reads unambiguously.
 */
import { ptsKey } from '@/entities/league/lib/ptsKey';
import { pairMatchups } from '@/entities/matchup/lib/pairMatchups';
import { weekTags } from '@/entities/matchup/lib/weekTags';
import type { RecordBook, RecordEntry } from '@/features/league-history/model/recordBook';
import type { SeasonBundle } from '@/features/league-history/model/buildSeasonBundle';
import { bundleOf, type Snapshot } from './league';

const n2 = (v: number): string => v.toFixed(2);

const SCORING: Record<string, string> = {
  pts_ppr: 'full PPR',
  pts_half_ppr: 'half PPR',
  pts_std: 'standard (no PPR)',
};

function standingsBlock(b: SeasonBundle, live: boolean): string {
  // A season that hasn't kicked off has no record worth printing — showing
  // 14 rows of 0-0 / 0.00 reads as a bug, not as an offseason.
  if (!live) return '(season has not started — no records yet)';
  // Sleeper only rolls roster season totals up after a week closes, so during
  // week 1 every row reads 0-0 / 0.00. Say so instead of printing the zeroes:
  // the live scores in the week block below are the real state of play.
  if (!b.standings.some((r) => r.w + r.l + r.t > 0)) {
    return '(no games decided yet this season — Sleeper only totals a week once it closes, so every record reads 0-0. The live scores below are what is actually happening.)';
  }
  return b.standings
    .map((r, i) => `${i + 1}. ${r.team} (${r.owner}) ${r.w}-${r.l}${r.t ? `-${r.t}` : ''}  PF ${n2(r.pf)}  PA ${n2(r.pa)}`)
    .join('\n');
}

function weekBlock(b: SeasonBundle, week: number): string {
  const pairs = pairMatchups(b.weeks[week - 1] ?? []);
  if (pairs.length === 0) return '(no matchups posted for this week)';
  const tags = weekTags(pairs);
  return pairs
    .map(([x, y]) => {
      const nx = b.names[x.r];
      const ny = b.names[y.r];
      // Precedence when a game holds several tags: NUKE > MASSACRE > PHOTO FINISH.
      const tag =
        tags.nuke === x.m ? "  [WEEK'S NUKE]" : tags.blow === x.m ? '  [MASSACRE]' : tags.close === x.m ? '  [PHOTO FINISH]' : '';
      return `${nx?.team ?? '?'} ${n2(x.p)} — ${n2(y.p)} ${ny?.team ?? '?'}${tag}`;
    })
    .join('\n');
}

function allTimeBlock(snap: Snapshot): string {
  const { agg, ownerMeta } = snap.allTime;
  return Object.entries(agg)
    .sort(([, a], [, b]) => b.titles - a.titles || b.w - a.w || b.pf - a.pf)
    .map(([id, a]) => {
      const m = ownerMeta[id];
      const trophies = [a.titles ? `${a.titles} title${a.titles > 1 ? 's' : ''}` : '', a.sackos ? `${a.sackos} sacko${a.sackos > 1 ? 's' : ''}` : '']
        .filter(Boolean)
        .join(', ');
      return `${m?.owner ?? id} (${m?.team ?? '?'}) ${a.w}-${a.l} over ${a.seasons} season${a.seasons > 1 ? 's' : ''}, PF ${n2(a.pf)}${trophies ? ` — ${trophies}` : ''}`;
    })
    .join('\n');
}

function titlesBlock(snap: Snapshot): string {
  return snap.bundles
    .map((b) => {
      if (b.status !== 'complete') return `${b.season}: in progress`;
      const champ = b.champ ? `${b.champ.team} (${b.champ.owner})` : 'unknown';
      const ru = b.ru ? `, runner-up ${b.ru.team} (${b.ru.owner})` : '';
      // The sacko badge is only real once the season is actually over.
      const sacko = b.sacko ? `, SACKO ${b.sacko.team} (${b.sacko.owner})` : '';
      return `${b.season}: CHAMPION ${champ}${ru}${sacko}`;
    })
    .join('\n');
}

/** `count: true` marks the records whose value is a tally of games or wins,
    not a score — "2 wins" reads as a typo if it renders as "2.00". */
const RECORD_LABELS: [keyof RecordBook, string, boolean?][] = [
  ['hiWk', 'Most points, one week'],
  ['loWk', 'Fewest points, one week'],
  ['blow', 'Biggest blowout (margin)'],
  ['close', 'Closest game (margin)'],
  ['shootout', 'Highest combined score'],
  ['bestLoss', 'Most points in a loss'],
  ['worstWin', 'Fewest points in a win'],
  ['streakW', 'Longest win streak (reg. season)', true],
  ['streakL', 'Longest losing streak (reg. season)', true],
  ['bestRec', 'Most wins in a season', true],
  ['hiPF', 'Most points, full season'],
  ['loPF', 'Fewest points, full season'],
  ['hiPA', 'Most points against, full season'],
];

function recordsBlock(recs: RecordBook): string {
  return RECORD_LABELS.map(([key, label, count]) => {
    const r = recs[key] as RecordEntry | null;
    if (!r) return null;
    return `${label}: ${count ? r.val : n2(r.val)} — ${r.who} (${r.sub})`;
  })
    .filter(Boolean)
    .join('\n');
}

/** The whole brief as one string. Stable enough between requests to sit behind
    a prompt-cache breakpoint; it only moves when a live week re-reads. */
export function leagueBrief(snap: Snapshot): string {
  const { active, liveWeek } = snap;
  const b = bundleOf(snap, active.season);
  const started = active.status === 'in_season' || active.status === 'complete';
  const seasons = snap.bundles.map((s) => s.season).join(', ');
  const pws = active.settings?.playoff_week_start ?? 15;

  const lines: (string | null)[] = [
    `LEAGUE: ${active.name} — 14 managers, Sleeper seasons ${seasons}.`,
    `Scoring: ${SCORING[ptsKey(active)] ?? 'unknown'}. Playoffs start week ${pws}.`,
    `Current season: ${active.season} (${active.status.replace('_', ' ')}).`,
    snap.nfl ? `NFL right now: ${snap.nfl.season} week ${snap.nfl.week} (${snap.nfl.season_type}).` : null,
    '',
    `== ${active.season} STANDINGS ==`,
    b ? standingsBlock(b, started) : '(unavailable)',
    '',
    `== ${active.season} WEEK ${liveWeek} ==`,
    b && started ? weekBlock(b, liveWeek) : '(offseason — no games)',
    '',
    '== ALL-TIME (every Sleeper season) ==',
    allTimeBlock(snap),
    '',
    '== CHAMPIONS & SACKOS ==',
    titlesBlock(snap),
    '',
    '== RECORD BOOK ==',
    recordsBlock(snap.recs),
  ];

  return lines.filter((l) => l !== null).join('\n');
}
