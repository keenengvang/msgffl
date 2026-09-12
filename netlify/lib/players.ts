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
import type { PlayersDb, RawPlayer, SeasonStats } from '@/shared/api/types';

const WEEK = 7 * 24 * 60 * 60_000;
const SIX_HOURS = 6 * 60 * 60_000;

let dbAt = 0;
let dbP: Promise<PlayersDb> | null = null;

export function playersDb(): Promise<PlayersDb> {
  if (!dbP || Date.now() - dbAt > WEEK) {
    dbAt = Date.now();
    dbP = api<Record<string, RawPlayer>>('/players/nfl')
      .then(trimPlayers)
      .catch((err) => {
        dbP = null; // don't cache a failure for a week
        throw err;
      });
  }
  return dbP;
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
