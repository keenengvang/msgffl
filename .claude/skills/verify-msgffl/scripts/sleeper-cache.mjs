// Disk cache for the public Sleeper API, shared by the browser (Playwright
// route) and the local bets function (wrapped global fetch).
//   VERIFY_SLEEPER=cache  (default) serve from disk, fetch live once on a miss and keep it
//   VERIFY_SLEEPER=replay never touch the network; a miss is a 599 and is listed in misses()
//   VERIFY_SLEEPER=live   always fetch live, never write the cache
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { home } from './paths.mjs';

export const SLEEPER = 'https://api.sleeper.app/';
const dir = join(home(), 'sleeper');
const mode = process.env.VERIFY_SLEEPER || 'cache';
const missed = new Set();
let liveCalls = 0;

const file = (url) => join(dir, createHash('sha1').update(url).digest('hex') + '.json');

export function cacheInfo() {
  if (!existsSync(dir)) return { dir, mode, entries: 0, oldest: null };
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const oldest = files.reduce((t, f) => Math.min(t, statSync(join(dir, f)).mtimeMs), Infinity);
  return { dir, mode, entries: files.length, oldest: files.length ? new Date(oldest).toISOString() : null };
}

export const misses = () => [...missed];
export const liveCallCount = () => liveCalls;

/** Resolve one Sleeper GET to {status, contentType, body: string}. */
export async function sleeperGet(url, realFetch = globalThis.fetch) {
  const f = file(url);
  if (mode !== 'live' && existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
  if (mode === 'replay') {
    missed.add(url);
    return { status: 599, contentType: 'text/plain', body: `verify-msgffl replay miss: ${url}` };
  }
  liveCalls++;
  const r = await realFetch(url);
  const entry = { url, status: r.status, contentType: r.headers.get('content-type') || 'application/json', body: await r.text() };
  // Only successes are kept: a Sleeper blip must not become a permanent fixture.
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
