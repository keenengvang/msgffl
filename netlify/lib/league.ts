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
import { LEAGUE_ID } from '@/shared/config/constants';
import { api } from '@/shared/api/sleeper';
import { walkChain } from '@/entities/league/lib/walkChain';
import { activeLeague } from '@/entities/league/lib/activeLeague';
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
function keep<T>(slot: Slot<T> | null, ttl: number, make: () => Promise<T>): Slot<T> {
  if (slot && Date.now() - slot.at < slot.ttl) return slot;
  const next: Slot<T> = { at: Date.now(), ttl, p: make() };
  next.p.catch(() => {
    next.ttl = 0;
  });
  return next;
}

let chainSlot: Slot<League[]> | null = null;
let nflSlot: Slot<NflState | null> | null = null;
const bundleSlots = new Map<string, Slot<SeasonBundle>>();
const rosterSlots = new Map<string, Slot<{ rosters: Roster[]; users: LeagueUser[] }>>();

function chain(): Promise<League[]> {
  chainSlot = keep(chainSlot, HOUR, () => walkChain(LEAGUE_ID));
  return chainSlot.p;
}

function nflState(): Promise<NflState | null> {
  // Same shape as useNflState: a failure here must not sink the whole answer.
  nflSlot = keep(nflSlot, 5 * 60_000, () => api<NflState>('/state/nfl').catch(() => null));
  return nflSlot.p;
}

function bundleFor(lg: League): Promise<SeasonBundle> {
  const ttl = lg.status === 'complete' ? Infinity : LIVE_TTL;
  const slot = keep(bundleSlots.get(lg.league_id) ?? null, ttl, () => buildSeasonBundle(lg));
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

export interface Snapshot {
  /** Newest season first, as walkChain returns it. */
  chain: League[];
  /** The season the site shows by default. */
  active: League;
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
  const lgs = await chain();
  if (lgs.length === 0) throw new Error('Sleeper returned an empty league chain');
  const active = activeLeague(lgs) ?? lgs[0]!;
  const [bundles, nfl] = await Promise.all([Promise.all(lgs.map(bundleFor)), nflState()]);

  return {
    chain: lgs,
    active,
    bundles,
    allTime: aggregateAllTime(bundles),
    recs: recordBook(bundles),
    h2h: h2h(bundles),
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
