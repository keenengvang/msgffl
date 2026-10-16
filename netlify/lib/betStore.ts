/**
 * Where bets live. The handler only ever sees `BetStore`, so leaving Netlify
 * means one new adapter (and a copy of `GET /bets` with no season — the full
 * export) — nothing in src/ changes, the browser only talks to the function.
 *
 * One key per bet (`<season>/<id>`), never one shared array: with a single
 * blob, two people saving at once means the second write silently eats the
 * first. Edits are conditional on the etag the editor last saw.
 */
import { getStore } from '@netlify/blobs';
import type { Bet } from '@/entities/bet/model/types';

export interface Versioned {
  bet: Bet;
  version: string;
}

export interface BetStore {
  /** Every bet in one season, or in every season when omitted. */
  list(season?: string): Promise<Versioned[]>;
  get(season: string, id: string): Promise<Versioned | null>;
  create(bet: Bet): Promise<Versioned>;
  /** null when `version` is stale — someone else saved first. */
  replace(bet: Bet, version: string): Promise<Versioned | null>;
}

const keyOf = (season: string, id: string) => `${season}/${id}`;

export function blobsBetStore(): BetStore {
  // Strong consistency: an edit must see the write that came just before it,
  // or the etag check compares against a stale copy.
  const store = getStore({ name: 'bets', consistency: 'strong' });

  const get = async (key: string): Promise<Versioned | null> => {
    const hit = await store.getWithMetadata(key, { type: 'json' });
    return hit?.etag ? { bet: hit.data as Bet, version: hit.etag } : null;
  };

  return {
    async list(season) {
      const { blobs } = await store.list(season ? { prefix: `${season}/` } : {});
      const all = await Promise.all(blobs.map((b) => get(b.key)));
      return all.filter((v): v is Versioned => v !== null);
    },
    get: (season, id) => get(keyOf(season, id)),
    async create(bet) {
      const res = await store.setJSON(keyOf(bet.season, bet.id), bet, { onlyIfNew: true });
      if (!res.modified || !res.etag) throw new Error(`bet ${bet.id} already exists`);
      return { bet, version: res.etag };
    },
    async replace(bet, version) {
      const res = await store.setJSON(keyOf(bet.season, bet.id), bet, { onlyIfMatch: version });
      return res.modified && res.etag ? { bet, version: res.etag } : null;
    },
  };
}

/** In-memory twin with the same etag semantics — for tests. */
export function memoryBetStore(): BetStore & { size(): number } {
  const rows = new Map<string, Versioned>();
  let n = 0;
  const stamp = (bet: Bet): Versioned => ({ bet: structuredClone(bet), version: `v${++n}` });
  return {
    size: () => rows.size,
    async list(season) {
      return [...rows.entries()]
        .filter(([k]) => !season || k.startsWith(`${season}/`))
        .map(([, v]) => structuredClone(v));
    },
    async get(season, id) {
      const v = rows.get(keyOf(season, id));
      return v ? structuredClone(v) : null;
    },
    async create(bet) {
      const k = keyOf(bet.season, bet.id);
      if (rows.has(k)) throw new Error(`bet ${bet.id} already exists`);
      const v = stamp(bet);
      rows.set(k, v);
      return structuredClone(v);
    },
    async replace(bet, version) {
      const k = keyOf(bet.season, bet.id);
      if (rows.get(k)?.version !== version) return null;
      const v = stamp(bet);
      rows.set(k, v);
      return structuredClone(v);
    },
  };
}
