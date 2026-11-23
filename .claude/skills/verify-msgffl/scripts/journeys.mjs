// The journeys behind features/*.md. Each one drives the built app the way a
// visitor does and asserts the END STATE its feature file names, read after
// the action (a second view, a reload, the stored row, the outbox), never just
// "the page rendered". Run through `verify.mjs drive [name…]`.
import { expect as baseExpect } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { openBrowser, newContext } from './browser.mjs';
import { runDir, repoRoot } from './paths.mjs';
import { misses, liveCallCount } from './sleeper-cache.mjs';

// configure() returns a new expect; Sleeper replays are instant, a cold cache is not.
const expect = baseExpect.configure({ timeout: 15_000 });

const heading = (page, name) => page.getByRole('heading', { level: 1, name });
// The router JSON-encodes search strings that look like numbers: ?season=%222024%22.
const param = (page, k) => (new URL(page.url()).searchParams.get(k) ?? '').replace(/^"|"$/g, '');
const firstNumber = (s) => Number((s.match(/[\d,]+/) ?? ['0'])[0].replace(/,/g, ''));

export const JOURNEYS = {
  // features/season.md
  async season({ page, step }) {
    await step('open standings with no season', () => page.goto('/standings'));
    await heading(page, /^Standings \d{4}$/).waitFor();
    await step('pick the 2024 pill', () => page.getByRole('banner').getByRole('button', { name: '2024', exact: true }).click());
    await expect(heading(page, 'Standings 2024')).toBeVisible();
    await step('URL carries season=2024', () => expect.poll(() => param(page, 'season')).toBe('2024'));
    await step('nav to MATCHUPS keeps 2024', () => page.getByRole('navigation').getByRole('link', { name: 'MATCHUPS', exact: true }).click());
    await expect(heading(page, 'Matchups 2024')).toBeVisible();
    await step('nav to PLAYERS keeps 2024', () => page.getByRole('navigation').getByRole('link', { name: 'PLAYERS', exact: true }).click());
    await expect(heading(page, 'Player Lab 2024')).toBeVisible();
    await step('reload keeps 2024', () => page.reload());
    await expect(heading(page, 'Player Lab 2024')).toBeVisible();
  },

  // features/matchups.md
  async matchups({ page, step, log }) {
    await step('open week 14 of 2024', () => page.goto('/matchups?season=2024&week=14'));
    await expect(page.getByText('REGULAR SEASON · WEEK 14')).toBeVisible();
    await step('pick WK 3', () => page.getByRole('button', { name: 'WK 3', exact: true }).click());
    await expect(page.getByText('REGULAR SEASON · WEEK 3')).toBeVisible();
    await expect.poll(() => param(page, 'week')).toBe('3');
    const cards = page.locator('main a[href*="/matchups/"]');
    await expect(cards).toHaveCount(7); // 14 teams → 7 games
    const hrefs = await cards.evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    await step(`all ${hrefs.length} cards link into week 3`, () => expect(hrefs.every((h) => h.startsWith('/matchups/3/'))).toBe(true));
    // Open a game that is NOT the first card, so a detail page that ignores
    // its id (and always shows game 1) fails here.
    const parse = async (i) => {
      const l = (await cards.nth(i).innerText()).split('\n').map((x) => x.trim()).filter(Boolean);
      const at = l.findIndex((x) => /^FINAL · MARGIN/.test(x));
      return { teams: [l[at + 1], l[at + 4]], scores: [l[at + 3], l[at + 6]], href: await cards.nth(i).getAttribute('href') };
    };
    const first = await parse(0);
    const game = await parse(3);
    log(`card 4: ${game.teams[0]} ${game.scores[0]} vs ${game.teams[1]} ${game.scores[1]} (${game.href}); card 1: ${first.teams.join(' vs ')}`);
    await step('card 4 is a different game from card 1', () => expect(game.teams.some((t) => first.teams.includes(t))).toBe(false));
    await step(`open card 4 (${game.teams.join(' vs ')})`, () => cards.nth(3).click());
    await expect(page.getByText(/STARTERS/).first()).toBeVisible();
    await expect.poll(() => new URL(page.url()).pathname).toBe(game.href.split('?')[0]);
    const back = page.getByRole('link', { name: /← WEEK 3/ });
    await expect(back).toBeVisible();
    await step('detail shows both of that game\'s teams and final scores, and neither of game 1\'s teams', async () => {
      const main = page.locator('main');
      for (const t of game.teams) await expect(main.getByText(t, { exact: true }).first()).toBeVisible();
      for (const sc of game.scores) await expect(main.getByText(sc, { exact: true }).first()).toBeVisible();
      for (const t of first.teams) await expect(main.getByText(t, { exact: true })).toHaveCount(0);
    });
    await step('back to the week', () => back.click());
    await expect(page.getByText('REGULAR SEASON · WEEK 3')).toBeVisible();
  },

  // features/players.md
  async players({ page, step }) {
    await step('open the 2024 Player Lab', () => page.goto('/players?season=2024'));
    const count = page.getByText(/[\d,]+ PLAYERS · TOP 150 SHOWN/);
    await expect(count).toBeVisible();
    const total = firstNumber(await count.innerText());
    const rows = page.locator('main [class*="_row_"]');
    const names = () => rows.locator('[class*="_name_"]').allInnerTexts();
    const positions = () => rows.locator('[class*="_pos_"]').allInnerTexts();
    await step('search "josh"', () => page.getByRole('textbox', { name: 'search a guy…' }).fill('josh'));
    await expect.poll(() => param(page, 'q')).toBe('josh');
    await expect.poll(async () => firstNumber(await count.innerText())).toBeLessThan(total);
    const josh = await names();
    await step(`every row's name holds "josh" (${josh.length} rows)`, () => expect(josh.length > 0 && josh.every((n) => /josh/i.test(n))).toBe(true));
    await step('pick QB', () => page.getByRole('button', { name: 'QB', exact: true }).click());
    await expect.poll(() => param(page, 'pos')).toBe('QB');
    await expect.poll(async () => { const p = await positions(); return p.length > 0 && p.every((x) => x.trim() === 'QB'); }).toBe(true);
    const qbs = await names();
    await step(`QB rows still all "josh": ${qbs.join(', ')}`, () => expect(qbs.every((n) => /josh/i.test(n))).toBe(true));
    await step('reload keeps q and pos', () => page.reload());
    await expect(page.getByRole('textbox', { name: 'search a guy…' })).toHaveValue('josh');
    await expect.poll(async () => (await names()).join('|')).toBe(qbs.join('|'));
  },

  // features/champion.md
  async champion({ page, step }) {
    await step('open the 2024 bracket', () => page.goto('/bracket?season=2024'));
    const banner = page.getByText(/^★ .+ — 2024 CHAMPION$/);
    await expect(banner).toBeVisible();
    const champ = (await banner.innerText()).replace(/^★ /, '').replace(/ — 2024 CHAMPION$/, '');
    // The CHAMPIONSHIP round as shown: name, then "W · pts" or "L · pts".
    const main = await page.locator('main').innerText();
    const lines = main.split('CHAMPIONSHIP')[1].split('★ TITLE GAME')[0].split('\n').map((s) => s.trim()).filter(Boolean);
    const winner = lines[lines.findIndex((l) => /^W · /.test(l)) - 1];
    await step(`banner "${champ}" is the title game's W side "${winner}"`, () => expect(champ.toLowerCase()).toBe(String(winner).toLowerCase()));
    await step('standings mark that team ★ CHAMPION', () => page.goto('/standings?season=2024'));
    const star = page.getByRole('link', { name: /★ CHAMPION/ });
    await expect(star).toHaveCount(1);
    await expect(star).toContainText(winner);
    await step('trophy wall says the same for 2024', () => page.goto('/history'));
    await expect(page.getByRole('heading', { name: 'TROPHY WALL' })).toBeVisible();
    const wall = await page.locator('main').innerText();
    const entry = wall.slice(wall.indexOf('2024 CHAMPION'), wall.indexOf('2024 CHAMPION') + 120);
    await step(`2024 entry names "${winner}": ${entry.replace(/\n/g, ' ')}`, () => expect(entry).toContain(winner));
  },

  // features/bets.md
  async bets({ page, step, state, evidence, log }) {
    const text = `verify-msgffl ${state.id} ${Date.now()}`;
    const stored = async (season = '2024') => {
      const all = (await (await page.request.get(`/.netlify/functions/bets${season ? `?season=${season}` : ''}`)).json()).bets;
      return all.find((b) => JSON.stringify(b).includes(text));
    };
    await step('open the 2024 board', () => page.goto('/bets?season=2024'));
    await expect(page.getByRole('button', { name: /BOOK IT/ })).toBeDisabled();
    // shared/ui/Picker is an ARIA listbox, not a <select>: open the trigger, click an option.
    const pick = async (label, option) => {
      await page.getByRole('combobox', { name: label }).click();
      const opts = page.getByRole('listbox', { name: label }).getByRole('option');
      await (typeof option === 'number' ? opts.nth(option) : opts.filter({ hasText: option }).first()).click();
      return page.getByRole('combobox', { name: label }).innerText();
    };
    const a = await pick('Team A', 0);
    const b = await pick('Team B', 1);
    await pick('Week', /^WEEK 3$/);
    log(`sides: ${a.trim()} vs ${b.trim()}, week 3`);
    await step('type the bet and book it', async () => {
      await page.getByRole('textbox', { name: 'The bet' }).fill(text);
      await page.getByRole('button', { name: /BOOK IT/ }).click();
    });
    const card = page.locator('[class*="_cardCell_"]').filter({ hasText: text });
    await expect(card).toHaveCount(1);
    await step('reload: the bet comes back from the server', () => page.reload());
    await expect(card).toHaveCount(1);
    let row = await stored();
    await step(`stored row ${row?.id}: week 3, no winner yet`, () => expect(row && row.week === 3 && !row.winner).toBeTruthy());
    // Two people editing at once, both from the same version: Blobs' conditional
    // write must let exactly one through, and the other gets 409 with the fresh copy.
    const edit = (suffix) =>
      page.request.fetch(`/.netlify/functions/bets?season=2024&id=${row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        data: { patch: { terms: `${text} ${suffix}` }, version: row.version },
      });
    const [ea, eb] = await Promise.all([edit('(edit A)'), edit('(edit B)')]);
    const codes = [ea.status(), eb.status()].sort();
    log(`concurrent edits from version ${row.version.slice(0, 10)}…: ${ea.status()} / ${eb.status()}`);
    await step('two edits from one version: one 200, one 409', () => expect(codes).toEqual([200, 409]));
    const won = ea.status() === 200 ? '(edit A)' : '(edit B)';
    row = await stored();
    await step(`stored terms are the winner's edit ${won}`, () => expect(row.terms).toBe(`${text} ${won}`));
    await step('reload: the card shows the saved edit', () => page.reload());
    await expect(card).toContainText(won);
    await step('rule Team A the winner', () => card.getByRole('button', { name: / won$/ }).first().click());
    await expect(card.getByRole('button', { name: /MARK PAID/ })).toBeVisible();
    await step('mark it paid', () => card.getByRole('button', { name: /MARK PAID/ }).click());
    await expect(card.getByRole('button', { name: 'UNDO PAID' })).toBeVisible();
    row = await stored();
    await step(`stored row: winner ${row?.winner}, paidAt ${row?.paidAt}`, () => expect(row.winner === 'A' && !!row.paidAt).toBeTruthy());
    page.once('dialog', (d) => d.accept());
    await step('delete it', () => card.getByRole('button', { name: 'DELETE' }).click());
    await expect(card).toHaveCount(0);
    await step('reload: still gone from the board', () => page.reload());
    await page.getByRole('button', { name: /BOOK IT/ }).waitFor();
    await expect(page.getByText(/BET RECORD/)).toBeVisible();
    await expect(card).toHaveCount(0);
    const kept = await stored('');
    await step(`the full export still holds it as a tombstone (deletedAt ${kept?.deletedAt})`, () => expect(kept && kept.deletedAt).toBeTruthy());
    evidence('bets-stored.json', JSON.stringify(kept, null, 2));
  },

  // features/suggest.md
  async suggest({ page, step, state, evidence }) {
    const outbox = join(runDir(state.id), 'github-outbox.jsonl');
    const sent = () => (existsSync(outbox) ? readFileSync(outbox, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
    const before = sent().length;
    const box = page.getByRole('textbox', { name: /two flex spots/ });
    const text = `verify-msgffl ${state.id} make the sacko wear a tutu`;
    await step('GitHub is down', () => page.request.get('/__verify/github?down=1'));
    await step('open the suggestion box', () => page.goto('/suggest'));
    await page.locator('main select').selectOption('Keeneng');
    await box.fill(text);
    await step('submit while HQ is unreachable', () => page.getByRole('button', { name: /SUBMIT TO LEAGUE/ }).click());
    await expect(page.getByText(/HQ UNREACHABLE|Couldn't reach HQ/)).toBeVisible();
    await step('the text survives in the box', () => expect(box).toHaveValue(text));
    await step('nothing was filed', () => expect(sent().length).toBe(before));
    await step('GitHub is back; submit again', async () => {
      await page.request.get('/__verify/github?down=0');
      await page.getByRole('button', { name: /SUBMIT TO LEAGUE/ }).click();
    });
    await expect(page.getByText(/FILED AS TICKET #\d+|Submitted — ticket #\d+/)).toBeVisible();
    await step('the box is cleared after success', () => expect(box).toHaveValue(''));
    const filed = sent().slice(before);
    await step('exactly one issue filed, labelled suggestion, signed by Keeneng', () =>
      expect(filed.length === 1 && filed[0].request.labels.includes('suggestion') && filed[0].request.body.includes('**Keeneng**') && filed[0].request.body.startsWith(text)).toBeTruthy());
    evidence('github-outbox.json', JSON.stringify(filed, null, 2));
  },

  // features/weekly-wrap.md
  async wrap({ page, step }) {
    const dir = join(repoRoot(), 'content', 'weekly-summaries');
    const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
    const live = index.weeks.filter((w) => w.week >= 1);
    const newer = (a, b) => (b.season > a.season || (b.season === a.season && b.week > a.week) ? b : a);
    const newest = live.reduce(newer);
    const oldest = live.reduce((a, b) => (newer(a, b) === a ? b : a));
    const headline = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8')).headline;
    const article = page.getByRole('article');
    await step(`open the wrap: expect week ${newest.week} of ${newest.season}`, () => page.goto('/weekly-summary'));
    await expect(article.getByRole('heading', { level: 2 })).toHaveText(headline(newest.file), { ignoreCase: true });
    await step(`pick WK ${oldest.week} in the archive`, () => page.getByRole('navigation', { name: 'Recap archive' }).getByRole('button', { name: `WK ${oldest.week}`, exact: true }).click());
    await expect(article.getByRole('heading', { level: 2 })).toHaveText(headline(oldest.file), { ignoreCase: true });
    await expect(article).toContainText(new RegExp(`WEEK ${oldest.week}\\s*·\\s*${oldest.season}`));
    await step('no week-0 template in the archive', () => expect(page.getByRole('navigation', { name: 'Recap archive' }).getByRole('button', { name: 'WK 0', exact: true })).toHaveCount(0));
    await step('reload: the newest is back (recaps are never persisted)', () => page.reload());
    await expect(article.getByRole('heading', { level: 2 })).toHaveText(headline(newest.file), { ignoreCase: true });
  },
};

/** The server's own Sleeper counters (the functions' requests), so a drive's
    summary covers both processes. */
async function serverSleeper(state) {
  return (await fetch(`${state.url}/__verify/sleeper`)).json();
}

export async function run(state, names, { headed }) {
  const list = names.includes('all') ? Object.keys(JOURNEYS) : names;
  const unknown = list.filter((n) => !JOURNEYS[n]);
  if (unknown.length) { console.error(`unknown journey: ${unknown.join(', ')} (have: ${Object.keys(JOURNEYS).join(', ')})`); return false; }
  const serverBefore = await serverSleeper(state);
  const browser = await openBrowser({ headed });
  const results = [];
  for (const name of list) {
    const dir = join(runDir(state.id), 'journeys', name);
    mkdirSync(dir, { recursive: true });
    const log = [];
    const ctx = await newContext(browser, state);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    let current = 'start';
    const step = async (what, fn) => { current = what; log.push(`→ ${what}`); const r = await fn(); log.push(`  ✓ ${page.url().replace(state.url, '')}`); return r; };
    const evidence = (file, body) => writeFileSync(join(dir, file), body);
    const t0 = Date.now();
    let error = null;
    try {
      await JOURNEYS[name]({ page, ctx, state, step, evidence, log: (m) => log.push(`  · ${m}`) });
      if (errors.length) throw new Error(`uncaught page errors: ${errors.join(' | ')}`);
    } catch (e) {
      error = `after "${current}": ${String(e?.message || e).split('\n').slice(0, 6).join('\n')}`;
      log.push(`  ✗ ${error}`);
    }
    try {
      await page.screenshot({ path: join(dir, 'final.png') });
      writeFileSync(join(dir, 'final.aria.txt'), await page.locator('body').ariaSnapshot());
    } catch { /* page gone */ }
    writeFileSync(join(dir, 'steps.log'), `${name} @ ${state.sha}${state.dirty ? '+dirty' : ''} tree=${state.tree} ${new Date().toISOString()}\n${log.join('\n')}\n`);
    await ctx.close();
    const r = { name, ok: !error, ms: Date.now() - t0, error, evidence: dir };
    results.push(r);
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${name} (${(r.ms / 1000).toFixed(1)}s)${error ? `\n  ${error.replace(/\n/g, '\n  ')}` : ''}`);
  }
  await browser.close();
  const serverAfter = await serverSleeper(state);
  const server = {
    liveCalls: serverAfter.liveCalls - serverBefore.liveCalls,
    replayMisses: serverAfter.replayMisses.filter((u) => !serverBefore.replayMisses.includes(u)),
  };
  const inBrowser = { liveCalls: liveCallCount(), replayMisses: misses() };
  const summary = { sha: state.sha, dirty: state.dirty, tree: state.tree, at: new Date().toISOString(), sleeper: { mode: state.sleeper, browser: inBrowser, server }, results };
  writeFileSync(join(runDir(state.id), 'results.json'), JSON.stringify(summary, null, 2));
  const missed = inBrowser.replayMisses.length + server.replayMisses.length;
  console.log(`${results.filter((r) => r.ok).length}/${results.length} passed · sleeper live calls: browser ${inBrowser.liveCalls}, server ${server.liveCalls}${missed ? ` · replay misses ${missed}` : ''} · ${state.sha}${state.dirty ? '+dirty' : ''} tree=${state.tree} · evidence ${runDir(state.id)}`);
  return results.every((r) => r.ok);
}

export async function snapshotPage(state, path) {
  const b = await openBrowser();
  const ctx = await newContext(b, state);
  const p = await ctx.newPage();
  await p.goto(path);
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.waitForTimeout(Number(process.env.WAIT || 1500));
  console.log(await p.locator('body').ariaSnapshot());
  await b.close();
}
