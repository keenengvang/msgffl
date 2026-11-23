// One browser context wired the way every journey needs it:
//   Sleeper API   → disk cache (sleeper-cache.mjs), browser and server share it
//   weekly recaps → this checkout's content/weekly-summaries/ (the site reads them raw from GitHub main)
//   sleepercdn.com images → aborted (avatars and headshots fall back per image; saves bandwidth)
import { chromium } from 'playwright';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sleeperGet, SLEEPER } from './sleeper-cache.mjs';
import { repoRoot } from './paths.mjs';

const RECAPS = 'https://raw.githubusercontent.com/keenengvang/msgffl/main/content/weekly-summaries/';

export async function openBrowser({ headed = false } = {}) {
  try {
    return await chromium.launch({ headless: !headed });
  } catch {
    return chromium.launch({ headless: !headed, channel: 'chrome' });
  }
}

export async function newContext(browser, state) {
  // x-verify-client: the stand-in uses it as the client IP, so each context gets
  // its own rate-limit bucket in the functions (suggest allows 5 an hour per IP).
  const ctx = await browser.newContext({ baseURL: state.url, viewport: { width: 1360, height: 900 }, extraHTTPHeaders: { 'x-verify-client': `verify-${randomUUID()}` } });
  const offsite = [];
  await ctx.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith(state.url)) return route.continue();
    if (url.startsWith(SLEEPER)) {
      const e = await sleeperGet(url);
      return route.fulfill({ status: e.status, contentType: e.contentType, body: e.body, headers: { 'access-control-allow-origin': '*' } });
    }
    if (url.startsWith(RECAPS)) {
      const name = new URL(url).pathname.split('/').pop();
      const f = join(repoRoot(), 'content', 'weekly-summaries', name);
      return existsSync(f)
        ? route.fulfill({ status: 200, contentType: 'application/json', body: readFileSync(f, 'utf8'), headers: { 'access-control-allow-origin': '*' } })
        : route.fulfill({ status: 404, body: 'not in checkout' });
    }
    offsite.push(url);
    return route.abort();
  });
  ctx.offsite = offsite;
  return ctx;
}
