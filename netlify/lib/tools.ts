/**
 * The analyst's tools.
 *
 * Deliberately NOT a mirror of the Sleeper endpoints. Sleeper speaks in
 * roster_ids and opaque player ids — `/matchups/7` is 28 rows of
 * {matchup_id, roster_id, points} with no names in sight — so endpoint-shaped
 * tools would make the model do three round-trips and a join just to answer
 * "who played who". These are shaped like the questions people actually ask,
 * and each is backed by the same pure function the site renders from, so the
 * bot and the page it floats over can't disagree about a number.
 *
 * Every tool that takes a team accepts free text and resolves it through
 * names.ts, handing back candidates rather than guessing when it's ambiguous.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { ptsKey } from '@/entities/league/lib/ptsKey';
import { pairMatchups } from '@/entities/matchup/lib/pairMatchups';
import { weekTags } from '@/entities/matchup/lib/weekTags';
import { bundleOf, hasStarted, rostersFor, type Snapshot } from './league';
import { people, resolvePerson, type Person } from './names';
import { playerIndex, seasonStats, weekProjections, type Projections } from './players';

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_team',
    description:
      "One manager in depth: their all-time record, every season they've played, titles and sackos, their best and worst rivalries, and their current roster with each player's projected points for this week, best first. This is the tool for start/sit questions — it tells you who is on the bench and what each of them is projected to score.",
    input_schema: {
      type: 'object',
      properties: {
        team: {
          type: 'string',
          description: 'Team name or manager name, as the user said it. Partial names are fine.',
        },
      },
      required: ['team'],
    },
  },
  {
    name: 'get_matchups',
    description:
      "Every game in one week of one season, with team names, final scores and the week's tags. Use for any question about a specific week other than the current one, which is already in the brief.",
    input_schema: {
      type: 'object',
      properties: {
        week: { type: 'number', description: 'Week number, 1-17.' },
        season: {
          type: 'string',
          description: 'Four-digit season, e.g. "2024". Defaults to the current season.',
        },
      },
      required: ['week'],
    },
  },
  {
    name: 'get_head_to_head',
    description:
      'The rivalry record between two managers, plus every regular-season meeting with scores. Regular season only — playoff meetings are excluded, which is how this league reckons a rivalry.',
    input_schema: {
      type: 'object',
      properties: {
        team_a: { type: 'string', description: 'First team or manager name.' },
        team_b: { type: 'string', description: 'Second team or manager name.' },
      },
      required: ['team_a', 'team_b'],
    },
  },
  {
    name: 'get_season',
    description:
      'Final standings for one season, with champion, runner-up and sacko. Use for questions about a season other than the current one.',
    input_schema: {
      type: 'object',
      properties: { season: { type: 'string', description: 'Four-digit season, e.g. "2023".' } },
      required: ['season'],
    },
  },
  {
    name: 'search_players',
    description:
      "Look up NFL players by name or position: their NFL team, age, this season's fantasy points so far, their projected points for this week, and which manager rosters them, if anyone. All points are in this league's scoring.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Player name or part of one. Omit to list by position alone.' },
        position: {
          type: 'string',
          enum: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'],
          description: 'Filter by position.',
        },
        limit: { type: 'number', description: 'How many to return, 1-15. Default 5.' },
      },
      required: [],
    },
  },
];

export interface ToolOutcome {
  content: string;
  isError?: boolean;
}

const ok = (v: unknown): ToolOutcome => ({ content: JSON.stringify(v) });
const fail = (msg: string): ToolOutcome => ({ content: msg, isError: true });

const n2 = (v: number): number => Number(v.toFixed(2));

const isOutcome = (v: unknown): v is ToolOutcome =>
  typeof v === 'object' && v !== null && 'content' in v;

/** Projections only mean something while a season is actually being played.
    Out of season there is no live week to project, so don't ask for one. */
function projectionsFor(snap: Snapshot): Promise<Projections> {
  if (snap.current.status !== 'in_season') return Promise.resolve({});
  return weekProjections(snap.current.season, snap.liveWeek);
}

/** Resolve a team argument, or produce the error text that tells the model to
    ask the user which manager they meant instead of picking one. */
function personOr(query: string, roster: Person[]): Person | ToolOutcome {
  const { hit, candidates } = resolvePerson(query, roster);
  if (hit) return hit;
  const names = candidates.slice(0, 14).map((p) => `${p.team} (${p.owner})`);
  return fail(
    `"${query}" matches ${candidates.length === 0 ? 'nobody' : `${candidates.length} managers`} in this league. ` +
      `Ask the user which they meant. Managers: ${names.join('; ')}`,
  );
}

async function getTeam(snap: Snapshot, team: string): Promise<ToolOutcome> {
  const who = personOr(team, people(snap));
  if (isOutcome(who)) return who;

  const agg = snap.allTime.agg[who.ownerId];
  const seasons = snap.bundles
    // Seasons the manager has actually played: a pre-draft season would list a
    // 0-0 record and a seed that is only sort order.
    .filter(hasStarted)
    .map((b) => {
      const i = b.standings.findIndex((r) => r.ownerId === who.ownerId);
      if (i < 0) return null;
      const r = b.standings[i]!;
      return {
        season: b.season,
        // Standings order, not final placement: the bracket decides the
        // postseason, so a champion can sit mid-table here. Naming it "finish"
        // invited the model to report a title winner as having finished 5th.
        regularSeasonSeed: i + 1,
        of: b.standings.length,
        record: `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}`,
        pf: n2(r.pf),
        pa: n2(r.pa),
        champion: b.champ?.ownerId === who.ownerId,
        // The sacko badge only exists once the season is actually over.
        sacko: b.status === 'complete' && b.sacko?.ownerId === who.ownerId,
      };
    })
    .filter(Boolean);

  const meta = snap.allTime.ownerMeta;
  const rivals = Object.entries(snap.h2h[who.ownerId] ?? {})
    .map(([id, rec]) => ({ vs: meta[id]?.owner ?? id, w: rec.w, l: rec.l }))
    .sort((a, b) => b.w - b.l - (a.w - a.l));

  // The roster only means anything for the season currently being played.
  let roster: {
    name: string;
    pos: string;
    nflTeam: string;
    starter: boolean;
    projectedThisWeek: number | null;
    status?: string;
  }[] = [];
  try {
    const key = ptsKey(snap.current);
    const [{ rosters }, { db, benched }, proj] = await Promise.all([
      // snap.current, not snap.active: during the pre-draft window `active` is
      // still last season, and its rosters are last season's squads.
      rostersFor(snap.current),
      playerIndex(),
      projectionsFor(snap),
    ]);
    const mine = rosters.find((r) => r.owner_id === who.ownerId);
    const starters = new Set(mine?.starters ?? []);
    roster = (mine?.players ?? [])
      .map((id) => {
        // Rosters keep IR players, whom the active-only trim drops.
        const info = db[id] ?? benched[id];
        return {
          name: info?.n ?? `unknown player (${id})`,
          pos: info?.p ?? '?',
          nflTeam: info?.t ?? '?',
          starter: starters.has(id),
          projectedThisWeek: proj[id]?.[key] ?? null,
          ...(benched[id] ? { status: benched[id]!.status } : {}),
        };
      })
      // Best projection first, so a start/sit question reads off the top.
      .sort((x, y) => (y.projectedThisWeek ?? -1) - (x.projectedThisWeek ?? -1));
  } catch {
    // A players-db hiccup shouldn't sink the whole answer — the history above
    // is the part that matters, so it goes back with an empty roster.
  }

  return ok({
    manager: who.owner,
    team: who.team,
    allTime: agg
      ? {
          record: `${agg.w}-${agg.l}`,
          pf: n2(agg.pf),
          titles: agg.titles,
          sackos: agg.sackos,
          seasons: agg.seasons,
        }
      : null,
    seasons,
    bestRivalries: rivals.slice(0, 3),
    worstRivalries: rivals.slice(-3).reverse(),
    roster,
  });
}

function getMatchups(snap: Snapshot, week: number, season?: string): ToolOutcome {
  const s = season ?? snap.active.season;
  const b = bundleOf(snap, s);
  if (!b) return fail(`No season ${s} in this league. Seasons: ${snap.bundles.map((x) => x.season).join(', ')}.`);
  if (!Number.isInteger(week) || week < 1 || week > 17) return fail('Week must be a whole number from 1 to 17.');

  const pairs = pairMatchups(b.weeks[week - 1] ?? []);
  if (pairs.length === 0) return ok({ season: s, week, played: false, games: [] });
  const tags = weekTags(pairs);
  // The week being played right now has provisional scores. Reporting a
  // `winner` here would tell the model a game in progress is already decided —
  // the same trap the record book and head-to-head paths already avoid.
  const live = snap.current.status === 'in_season' && s === snap.current.season && week === snap.liveWeek;

  return ok({
    season: s,
    week,
    playoffs: week >= b.pws,
    inProgress: live,
    ...(live
      ? { note: 'This week is still being played — these are live scores, so report a leader, never a winner.' }
      : {}),
    games: pairs.map(([x, y]) => {
      const [hi, lo] = x.p >= y.p ? [x, y] : [y, x];
      const ahead = hi.p === lo.p ? null : (b.names[hi.r]?.team ?? '?');
      return {
        home: { team: b.names[x.r]?.team ?? '?', manager: b.names[x.r]?.owner ?? '?', points: n2(x.p) },
        away: { team: b.names[y.r]?.team ?? '?', manager: b.names[y.r]?.owner ?? '?', points: n2(y.p) },
        ...(live ? { leader: ahead } : { winner: ahead }),
        margin: n2(hi.p - lo.p),
        // Precedence when a game holds several: NUKE > MASSACRE > PHOTO FINISH.
        tag:
          tags.nuke === x.m
            ? "WEEK'S NUKE"
            : tags.blow === x.m
              ? 'MASSACRE'
              : tags.close === x.m
                ? 'PHOTO FINISH'
                : null,
      };
    }),
  });
}

function getHeadToHead(snap: Snapshot, a: string, bq: string): ToolOutcome {
  const roster = people(snap);
  const pa = personOr(a, roster);
  if (isOutcome(pa)) return pa;
  const pb = personOr(bq, roster);
  if (isOutcome(pb)) return pb;
  if (pa.ownerId === pb.ownerId) return fail('Those two names resolve to the same manager.');

  // A game being played RIGHT NOW carries provisional scores. Counting it as a
  // decided result means asking about a rivalry mid-Sunday reports whoever is
  // ahead as having won. Hold it out of the record and report it separately.
  const liveSeason = snap.current.status === 'in_season' ? snap.current.season : null;
  const isLive = (season: string, week: number) => season === liveSeason && week === snap.liveWeek;

  const meetings: { season: string; week: number; a: number; b: number; winner: string }[] = [];
  let inProgress: { season: string; week: number; a: number; b: number; leader: string } | null = null;

  // Same scan rule as h2h(): regular season only, skip unplayed 0-0 pairs.
  snap.bundles.forEach((bundle) => {
    bundle.weeks.forEach((wl, wi) => {
      if (wi + 1 >= bundle.pws) return;
      pairMatchups(wl ?? []).forEach(([x, y]) => {
        const ox = bundle.names[x.r]?.ownerId;
        const oy = bundle.names[y.r]?.ownerId;
        if (!ox || !oy) return;
        const mine = ox === pa.ownerId ? x : oy === pa.ownerId ? y : null;
        const theirs = ox === pb.ownerId ? x : oy === pb.ownerId ? y : null;
        if (!mine || !theirs) return;
        if ((mine.p || 0) === 0 && (theirs.p || 0) === 0) return;
        if (isLive(bundle.season, wi + 1)) {
          inProgress = {
            season: bundle.season,
            week: wi + 1,
            a: n2(mine.p),
            b: n2(theirs.p),
            leader: mine.p === theirs.p ? 'level' : mine.p > theirs.p ? pa.owner : pb.owner,
          };
          return;
        }
        meetings.push({
          season: bundle.season,
          week: wi + 1,
          a: n2(mine.p),
          b: n2(theirs.p),
          winner: mine.p === theirs.p ? 'tie' : mine.p > theirs.p ? pa.owner : pb.owner,
        });
      });
    });
  });

  return ok({
    a: { manager: pa.owner, team: pa.team },
    b: { manager: pb.owner, team: pb.team },
    // Counted from the decided meetings above rather than read off snap.h2h,
    // which aggregates every bundle and so folds in a game still being played.
    record: `${pa.owner} is ${meetings.filter((m) => m.winner === pa.owner).length}-${
      meetings.filter((m) => m.winner === pb.owner).length
    } against ${pb.owner}`,
    note: 'Regular season only — playoff meetings are excluded, and a game still being played is reported under inProgress rather than counted.',
    meetings,
    inProgress,
  });
}

function getSeason(snap: Snapshot, season: string): ToolOutcome {
  const b = bundleOf(snap, season);
  if (!b)
    return fail(`No season ${season} in this league. Seasons: ${snap.bundles.map((x) => x.season).join(', ')}.`);
  const done = b.status === 'complete';
  return ok({
    season: b.season,
    status: b.status,
    playoffsStartWeek: b.pws,
    champion: b.champ ? `${b.champ.team} (${b.champ.owner})` : null,
    runnerUp: b.ru ? `${b.ru.team} (${b.ru.owner})` : null,
    sacko: done && b.sacko ? `${b.sacko.team} (${b.sacko.owner})` : null,
    standings: b.standings.map((r, i) => ({
      rank: i + 1,
      team: r.team,
      manager: r.owner,
      record: `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}`,
      pf: n2(r.pf),
      pa: n2(r.pa),
    })),
  });
}

async function searchPlayers(
  snap: Snapshot,
  query: string | undefined,
  position: string | undefined,
  limit: number | undefined,
): Promise<ToolOutcome> {
  if (!query && !position) return fail('Give a player name, a position, or both.');
  const cap = Math.min(Math.max(Math.trunc(limit ?? 5), 1), 15);
  const key = ptsKey(snap.active);

  const [{ db, benched }, stats, proj] = await Promise.all([
    playerIndex(),
    seasonStats(snap.active.season, snap.active.status === 'complete'),
    projectionsFor(snap),
  ]);

  // Who rosters whom, this season — read off the newest league, since during
  // the pre-draft window snap.active is still last season.
  const owned = new Map<string, string>();
  try {
    const { rosters, users } = await rostersFor(snap.current);
    const teamOf = new Map(users.map((u) => [u.user_id, u.metadata?.team_name || u.display_name]));
    rosters.forEach((r) => (r.players ?? []).forEach((id) => owned.set(id, teamOf.get(r.owner_id) ?? 'unknown')));
  } catch {
    // Ownership is a nice-to-have; the stat line is the answer.
  }

  // Inactive players are searchable too: someone asking after an injured guy
  // usually asks BECAUSE he's hurt, and he may well still be on a roster.
  // playerIndex already holds them, so not merging them here made the lookup
  // deny the existence of players the league is actively worrying about.
  const searchable: Record<string, { n: string; p: string; t: string; a?: number; status?: string }> = {
    ...db,
    ...benched,
  };

  const q = (query ?? '').toLowerCase().trim();
  const hits = Object.entries(searchable)
    .filter(([, p]) => (!q || p.n.toLowerCase().includes(q)) && (!position || p.p === position))
    .map(([id, p]) => ({
      name: p.n,
      pos: p.p,
      nflTeam: p.t,
      age: p.a || null,
      seasonPoints: n2(stats[id]?.[key] ?? 0),
      projectedThisWeek: proj[id]?.[key] ?? null,
      rosteredBy: owned.get(id) ?? null,
      ...(p.status ? { status: p.status } : {}),
    }))
    .sort((x, y) => y.seasonPoints - x.seasonPoints);

  return ok({
    season: snap.active.season,
    week: snap.liveWeek,
    scoring: key,
    projectionSource: "Sleeper's own weekly projection, in this league's scoring",
    matches: hits.length,
    players: hits.slice(0, cap),
  });
}

/** Dispatch one tool_use block. Anything that throws comes back as an error
    result rather than a 502 — a bad tool call should cost a turn, not the chat. */
export async function runTool(name: string, input: unknown, snap: Snapshot): Promise<ToolOutcome> {
  const a = (input ?? {}) as Record<string, unknown>;
  try {
    switch (name) {
      case 'get_team':
        return await getTeam(snap, String(a.team ?? ''));
      case 'get_matchups':
        return getMatchups(snap, Number(a.week), a.season == null ? undefined : String(a.season));
      case 'get_head_to_head':
        return getHeadToHead(snap, String(a.team_a ?? ''), String(a.team_b ?? ''));
      case 'get_season':
        return getSeason(snap, String(a.season ?? ''));
      case 'search_players':
        return await searchPlayers(
          snap,
          a.query == null ? undefined : String(a.query),
          a.position == null ? undefined : String(a.position),
          a.limit == null ? undefined : Number(a.limit),
        );
      default:
        return fail(`No tool named ${name}.`);
    }
  } catch (err) {
    console.error(`tool ${name} failed`, err);
    return fail(`${name} could not be completed. Answer from the league brief instead, or say you don't have it.`);
  }
}
