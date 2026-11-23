// Disk cache for the public Sleeper API, shared by the browser (Playwright
// route) and the local bets function (wrapped global fetch).
//
// The mode is chosen once, at launch (VERIFY_SLEEPER, default cache), stored in
// the run's state.json, and handed to both the server and every drive from
// there: one run never mixes modes. A drive whose VERIFY_SLEEPER disagrees with
// its run's is refused (verify.mjs).
//   cache   serve from disk; a miss, or an entry older than VERIFY_SLEEPER_TTL_HOURS
//           (default 24), is fetched live once and kept
//   replay  never touch the network; a miss is a 599 and is listed in results.json
//   live    always fetch live, never write the cache
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { home } from './paths.mjs';

export const SLEEPER = 'https://api.sleeper.app/';
export const MODES = ['cache', 'replay', 'live'];
const dir = join(home(), 'sleeper');
const ttlMs = Number(process.env.VERIFY_SLEEPER_TTL_HOURS || 24) * 3600_000;
let mode = 'cache';
const missed = new Set();
let liveCalls = 0;

export function setMode(m) {
  if (!MODES.includes(m)) throw new Error(`VERIFY_SLEEPER must be one of ${MODES.join(', ')} (got ${m})`);
  mode = m;
}
export const getMode = () => mode;

const file = (url) => join(dir, createHash('sha1').update(url).digest('hex') + '.json');

export function cacheInfo() {
  if (!existsSync(dir)) return { dir, entries: 0, oldest: null, ttlHours: ttlMs / 3600_000 };
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const oldest = files.reduce((t, f) => Math.min(t, statSync(join(dir, f)).mtimeMs), Infinity);
  return { dir, entries: files.length, oldest: files.length ? new Date(oldest).toISOString() : null, ttlHours: ttlMs / 3600_000 };
}

export const misses = () => [...missed];
export const liveCallCount = () => liveCalls;

/** Resolve one Sleeper GET to {status, contentType, body: string}. */
export async function sleeperGet(url, realFetch = globalThis.fetch) {
  const f = file(url);
  if (mode === 'replay') {
    if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
    missed.add(url);
    return { status: 599, contentType: 'text/plain', body: `verify-msgffl replay miss: ${url}` };
  }
  if (mode === 'cache' && existsSync(f) && Date.now() - statSync(f).mtimeMs < ttlMs) return JSON.parse(readFileSync(f, 'utf8'));
  liveCalls++;
  const r = await realFetch(url);
  const entry = { url, status: r.status, contentType: r.headers.get('content-type') || 'application/json', body: await r.text() };
  // Only successes are kept: a Sleeper blip must not become a fixture.
  if (mode === 'cache' && r.ok) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(f, JSON.stringify(entry));
  }
  return entry;
}

/** Make Node's fetch go through the cache for Sleeper URLs (the bets function's sleeperFacts). */
export function patchNodeFetch() {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url ?? String(input);
    if (url.startsWith(SLEEPER) && (!init?.method || init.method === 'GET')) {
      const e = await sleeperGet(url, real);
      return new Response(e.body, { status: e.status, headers: { 'content-type': e.contentType } });
    }
    return real(input, init);
  };
}
