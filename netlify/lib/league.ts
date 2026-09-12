/**
 * Server-side league data for the chat function.
 *
 * The browser gets this from TanStack Query; a Netlify Function has no such
 * cache, so this module is the server's version of it: the same Sleeper fetches
 * and the same pure math the site uses, held warm on the function instance.
 * Reusing `buildSeasonBundle` / `recordBook` / `h2h` / `aggregateAllTime` is the
 * point — the analyst and the page it sits on must never quote different
 * numbers for the same record.
 *
 * Freshness mirrors the client's staleTime table: the chain is good for an
 * hour, a completed season is immutable, a live one is re-read every 5 minutes.
 */
import { api } from '@/shared/api/sleeper';
import { fetchChain } from '@/entities/league/lib/fetchChain';
import { activeLeague, newestLeague } from '@/entities/league/lib/activeLeague';
import { computeStandings, usersById } from '@/entities/team/lib/computeStandings';
import { liveWeekFor } from '@/entities/matchup/lib/liveWeek';
import { buildSeasonBundle, type SeasonBundle } from '@/features/league-history/model/buildSeasonBundle';
import { aggregateAllTime, type AllTime } from '@/features/league-history/model/aggregateAllTime';
import { recordBook, type RecordBook } from '@/features/league-history/model/recordBook';
import { h2h, type H2hRecord } from '@/features/league-history/model/h2h';
import type { League, LeagueUser, NflState, Roster } from '@/shared/api/types';
import type { StandingRow } from '@/entities/team/model/types';

const HOUR = 60 * 60_000;
const LIVE_TTL = 5 * 60_000;

/** A value fetched once and kept warm on this function instance. */
interface Slot<T> {
  at: number;
  ttl: number;
  p: Promise<T>;
}

/** Return `slot` if it is still fresh, else start a new fetch. A rejected
    fetch is evicted immediately (ttl 0) so one Sleeper blip isn't cached for
    an hour; the `.catch` also keeps the rejection from going unhandled. */
function keep<T>(
  slot: Slot<T> | null,
  ttl: number,
  make: () => Promise<T>,
  /** Given the resolved value, return the TTL it actually deserves. Lets a
      caller downgrade a "cache forever" slot once it can see the value came
      back hollow. */
  reviseTtl?: (value: T) => number,
): Slot<T> {
  if (slot && Date.now() - slot.at < slot.ttl) return slot;
  const next: Slot<T> = { at: Date.now(), ttl, p: make() };
  next.p.then(
    (value) => {
      if (reviseTtl) next.ttl = reviseTtl(value);
    },
    () => {
      next.ttl = 0;
    },
  );
  return next;
}

let chainSlot: Slot<League[]> | null = null;
let nflSlot: Slot<NflState | null> | null = null;
const bundleSlots = new Map<string, Slot<SeasonBundle>>();
const rosterSlots = new Map<string, Slot<{ rosters: Roster[]; users: LeagueUser[] }>>();

/** Needs the NFL state: without it there is no forward auto-discovery, and the
    chain stops at whatever season LEAGUE_ID names — which is a season behind
    for most of the year. */
function chain(ns: NflState | null): Promise<League[]> {
  chainSlot = keep(chainSlot, HOUR, () => fetchChain(ns));
  return chainSlot.p;
}

function nflState(): Promise<NflState | null> {
  // Same shape as useNflState: a failure here must not sink the whole answer.
  nflSlot = keep(nflSlot, 5 * 60_000, () => api<NflState>('/state/nfl').catch(() => null));
  return nflSlot.p;
}

/** A finished season should have standings, played weeks and a champion from
    the winners bracket. buildSeasonBundle catches a failed bracket or matchup
    request and resolves with an empty array instead of rejecting, so a
    transient blip yields a hollow-but-successful bundle — which must not be
    the thing we keep forever. */
export function looksWhole(b: SeasonBundle): boolean {
  if (b.standings.length === 0 || b.champ === null) return false;
  // EVERY week through the title game must be there. Checking "some week has
  // entries" would pass a bundle missing exactly one failed week, and hold that
  // hole — a whole week absent from H2H and the record book — forever.
  const titleWeek = Math.min(b.pws + 2, 17);
  return b.weeks.slice(0, titleWeek).every((w) => w.length > 0);
}

function bundleFor(lg: League): Promise<SeasonBundle> {
  const ttl = lg.status === 'complete' ? Infinity : LIVE_TTL;
  const slot = keep(
    bundleSlots.get(lg.league_id) ?? null,
    ttl,
    () => buildSeasonBundle(lg),
    // Only a complete season that actually came back complete earns Infinity;
    // a partial one falls back to the live TTL so the next request retries.
    (b) => (ttl === Infinity && !looksWhole(b) ? LIVE_TTL : ttl),
  );
  bundleSlots.set(lg.league_id, slot);
  return slot.p;
}

/** Rosters + users for one season — the only thing bundles drop that the
    `get_team` tool needs (a bundle keeps standings, not who is on the bench). */
export function rostersFor(lg: League): Promise<{ rosters: Roster[]; users: LeagueUser[] }> {
  const ttl = lg.status === 'complete' ? Infinity : LIVE_TTL;
  const slot = keep(rosterSlots.get(lg.league_id) ?? null, ttl, async () => {
    const [rosters, users] = await Promise.all([
      api<Roster[]>(`/league/${lg.league_id}/rosters`),
      api<LeagueUser[]>(`/league/${lg.league_id}/users`),
    ]);
    return { rosters, users };
  });
  rosterSlots.set(lg.league_id, slot);
  return slot.p;
}

/** A season counts toward a career only once it is being played. Sleeper mints
    the next league months early, and counting that pre-draft bundle gives every
    manager an extra "season played" for a year nobody has lined up for yet. */
export function hasStarted(b: SeasonBundle): boolean {
  return b.status !== 'pre_draft' && b.status !== 'drafting';
}

/** The bundles with the in-progress week removed, for anything that states a
    finished result. No-op unless a season is actually being played. */
export function settleBundles(bundles: SeasonBundle[], current: League, liveWeek: number): SeasonBundle[] {
  if (current.status !== 'in_season') return bundles;
  return bundles.map((b) =>
    b.season === current.season
      ? { ...b, weeks: b.weeks.map((w, i) => (i + 1 === liveWeek ? [] : w)) }
      : b,
  );
}

export interface Snapshot {
  /** Newest season first, including the season auto-discovered by fetchChain. */
  chain: League[];
  /** The season the site shows by default: newest complete or in-season. */
  active: League;
  /** The newest league in the chain, which may be a pre-draft season `active`
      deliberately skips. Rosters and ownership live here — during the
      pre-draft window `active` is last year, and reading rosters off it would
      label last season's squads as "this season's". */
  current: League;
  bundles: SeasonBundle[];
  allTime: AllTime;
  recs: RecordBook;
  /** h2h[ownerA][ownerB] = A's regular-season record vs B. */
  h2h: Record<string, Record<string, H2hRecord>>;
  nfl: NflState | null;
  /** The week the active season is "on" — same rule the /matchups page uses. */
  liveWeek: number;
}

/** Everything the analyst can reason about, in one object. The aggregates are
    recomputed per call rather than cached (they're pure and cheap over a
    handful of seasons) — the same rule the pages follow. */
export async function snapshot(): Promise<Snapshot> {
  // Sequential on purpose: the chain's forward auto-discovery needs to know
  // what season the NFL is in, or it never finds the league Sleeper minted for
  // this year and the analyst answers from last season.
  const nfl = await nflState();
  const lgs = await chain(nfl);
  if (lgs.length === 0) throw new Error('Sleeper returned an empty league chain');
  const active = activeLeague(lgs) ?? lgs[0]!;
  const current = newestLeague(lgs) ?? active;
  const bundles = await Promise.all(lgs.map(bundleFor));
  const liveWeek = liveWeekFor({
    status: active.status,
    playoffWeekStart: active.settings?.playoff_week_start ?? 15,
    nflSeason: nfl?.season,
    nflWeek: nfl?.week,
    season: active.season,
  });

  // Records and rivalries are claims about SETTLED games. A week in progress
  // carries provisional scores, so feeding it to recordBook makes a 1-0 score
  // early on a Sunday the all-time lowest week (or worst win, or a streak),
  // and h2h hands whoever is currently ahead a completed win. Blank the live
  // week for those two, and only those two: standings and the matchup tools
  // still read `bundles` because showing the live score is the whole point.
  // Career totals cover seasons that have actually started. `bundles` keeps
  // the pre-draft season, because that's where current rosters live.
  const played = bundles.filter(hasStarted);
  const settled = settleBundles(played, current, liveWeek);

  return {
    chain: lgs,
    current,
    active,
    bundles,
    allTime: aggregateAllTime(played),
    recs: recordBook(settled),
    h2h: h2h(settled),
    nfl,
    liveWeek: liveWeekFor({
      status: active.status,
      playoffWeekStart: active.settings?.playoff_week_start ?? 15,
      nflSeason: nfl?.season,
      nflWeek: nfl?.week,
      season: active.season,
    }),
  };
}

export function bundleOf(snap: Snapshot, season: string): SeasonBundle | undefined {
  return snap.bundles.find((b) => b.season === season);
}

export function leagueOfSeason(snap: Snapshot, season: string): League | undefined {
  return snap.chain.find((l) => l.season === season);
}

/** Standings for a season straight from the live rosters — used by tools that
    need `rosterId` alignment with the roster payload. */
export function standingsFrom(rosters: Roster[], users: LeagueUser[]): StandingRow[] {
  return computeStandings(rosters, usersById(users));
}
