/**
 * The NFL player database, server-side.
 *
 * Loaded lazily and only by the tools that need a player name — the brief
 * never touches it. /players/nfl is ~5MB, so it is trimmed the moment it
 * lands (same rule as usePlayersDb: QB/RB/WR/TE/K/DEF, active-only except
 * DEF) and the raw payload is dropped. A cold load costs a second or two, so
 * keeping the untrimmed blob around would be the expensive mistake, not the
 * fetch itself.
 */
import { api } from '@/shared/api/sleeper';
import { trimPlayers } from '@/entities/player/lib/trimPlayers';
import type { PtsKey } from '@/entities/league/lib/ptsKey';
import type { PlayersDb, RawPlayer, SeasonStats } from '@/shared/api/types';

const WEEK = 7 * 24 * 60 * 60_000;
const SIX_HOURS = 6 * 60 * 60_000;

/** A player the shared trim drops but a roster can still hold. */
export interface BenchedPlayer {
  n: string;
  p: string;
  t: string;
  /** Sleeper's status/injury, e.g. "Inactive", "IR" — the reason they're here. */
  status: string;
}

export interface PlayerIndex {
  /** The shared trim: active fantasy players. Same rule as usePlayersDb. */
  db: PlayersDb;
  /** Fantasy-position players the trim dropped for being inactive. Rosters keep
      IR players, so without this a roster renders a bare Sleeper id — which is
      both useless and the opposite of an answer to "who should I start". */
  benched: Record<string, BenchedPlayer>;
}

const FANTASY = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);

let dbAt = 0;
let indexP: Promise<PlayerIndex> | null = null;

/** Both maps from ONE fetch — the 5MB payload is parsed once and dropped. */
export function playerIndex(): Promise<PlayerIndex> {
  if (!indexP || Date.now() - dbAt > WEEK) {
    dbAt = Date.now();
    const p: Promise<PlayerIndex> = api<Record<string, RawPlayer>>('/players/nfl')
      .then((raw) => {
        const benched: Record<string, BenchedPlayer> = {};
        for (const id in raw) {
          const p = raw[id];
          if (!p || !p.position || !FANTASY.has(p.position)) continue;
          if (p.position === 'DEF' || p.status === 'Active') continue; // kept by the trim
          benched[id] = {
            n: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
            p: p.position,
            t: p.team || 'FA',
            status: p.status || 'Inactive',
          };
        }
        return { db: trimPlayers(raw), benched };
      })
      .catch((err) => {
        indexP = null; // don't cache a failure for a week
        throw err;
      });
    indexP = p;
  }
  return indexP;
}

export function playersDb(): Promise<PlayersDb> {
  return playerIndex().then((i) => i.db);
}

/** Sleeper's weekly projections, trimmed to the three scoring totals.
 *
 * `/projections/nfl/regular/{season}/{week}` is undocumented but public, and
 * it's the same source the Sleeper app shows managers. The raw payload is
 * ~550KB of 93 stat keys across 9400 players; only ~850 carry a points
 * projection at all, so it's trimmed on arrival to a few KB — same discipline
 * as trimPlayers with /players/nfl.
 */
export type Projections = Record<string, Partial<Record<PtsKey, number>>>;

const PROJ_TTL = 30 * 60_000; // projections move through the week as news breaks
const projSlots = new Map<string, { at: number; p: Promise<Projections> }>();

export function weekProjections(season: string, week: number): Promise<Projections> {
  const key = `${season}-${week}`;
  const slot = projSlots.get(key);
  if (slot && Date.now() - slot.at < PROJ_TTL) return slot.p;

  const p = api<Record<string, Record<string, number>>>(`/projections/nfl/regular/${season}/${week}`)
    .then((raw) => {
      const out: Projections = {};
      for (const id in raw) {
        const r = raw[id];
        if (!r || r.pts_half_ppr == null) continue; // no projection worth reporting
        out[id] = { pts_ppr: r.pts_ppr, pts_half_ppr: r.pts_half_ppr, pts_std: r.pts_std };
      }
      return out;
    })
    // A missing projection is a thinner answer, never a failed one.
    .catch(() => ({}) as Projections);

  projSlots.set(key, { at: Date.now(), p });
  return p;
}

const statSlots = new Map<string, { at: number; p: Promise<SeasonStats> }>();

/** Season stat lines for one season. Past seasons never change; the live one
    is re-read every 6 hours, matching the client's staleTime. */
export function seasonStats(season: string, complete: boolean): Promise<SeasonStats> {
  const slot = statSlots.get(season);
  if (slot && (complete || Date.now() - slot.at < SIX_HOURS)) return slot.p;
  const p = api<SeasonStats>(`/stats/nfl/regular/${season}`).catch(() => ({}) as SeasonStats);
  statSlots.set(season, { at: Date.now(), p });
  return p;
}
