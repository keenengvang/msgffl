#!/usr/bin/env node
// verify-msgffl: launch / doctor / drive / snapshot / url / cleanup. See ../SKILL.md.
import { spawn, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync, openSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { home, repoRoot, runDir } from './paths.mjs';
import { cacheInfo, MODES } from './sleeper-cache.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(rest.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const positional = rest.filter((a) => !a.startsWith('--'));
const root = repoRoot();
const statePath = (id) => join(runDir(id), 'state.json');
const stampPath = () => join(root, 'dist', '.verify-build.json');
const die = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };
const git = (args) => execSync(`git ${args}`, { cwd: root, maxBuffer: 64 << 20 }).toString();

const loadState = (id) => (id && existsSync(statePath(id)) ? JSON.parse(readFileSync(statePath(id), 'utf8')) : null);
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

/** The newest run that is still alive, by when it started (not by its name). */
function latestRun() {
  const d = join(home(), 'runs');
  if (!existsSync(d)) return null;
  const live = readdirSync(d).map(loadState).filter((s) => s && alive(s.pid));
  live.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return live.at(-1)?.id ?? null;
}
const runId = () => flags.run || process.env.VERIFY_RUN || latestRun();

// Everything the build reads. The fingerprint is HEAD plus the uncommitted diff
// and untracked files under these paths, so any edit after a build changes it.
const APP = 'src netlify index.html public vite.config.ts package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json netlify.toml';
function fingerprint() {
  const h = createHash('sha256');
  h.update(git('rev-parse HEAD'));
  h.update(git(`diff HEAD --binary -- ${APP}`));
  for (const f of git(`ls-files --others --exclude-standard -- ${APP}`).split('\n').filter(Boolean)) h.update(f + '\0' + readFileSync(join(root, f)));
  // Gitignored inputs Vite still reads: .env, .env.<mode>, and their .local
  // twins. Hashed by name and content only; never printed.
  for (const f of readdirSync(root).filter((n) => /^\.env(\..+)?$/.test(n) || n.endsWith('.local')).sort()) h.update('env\0' + f + '\0' + readFileSync(join(root, f)));
  return h.digest('hex').slice(0, 16);
}
const shortSha = () => git('rev-parse --short HEAD').trim();
const readStamp = () => (existsSync(stampPath()) ? JSON.parse(readFileSync(stampPath(), 'utf8')) : null);

const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

async function launch() {
  const id = flags.run || `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
  if (loadState(id)) die(`run ${id} already has an instance; cleanup first`);
  const sleeper = process.env.VERIFY_SLEEPER || 'cache';
  if (!MODES.includes(sleeper)) die(`VERIFY_SLEEPER must be one of ${MODES.join(', ')}`);
  let stamp;
  if (!flags['no-build']) {
    console.log('building (npm run build)…');
    const tree = fingerprint();
    try {
      execSync('npm run build', { cwd: root, stdio: 'pipe' });
    } catch (e) {
      die(`npm run build failed:\n${String(e.stdout).split('\n').slice(-25).join('\n')}${e.stderr}`);
    }
    stamp = { sha: shortSha(), tree, builtAt: new Date().toISOString() };
    writeFileSync(stampPath(), JSON.stringify(stamp));
  } else {
    // dist/ says what it was built from; HEAD is not evidence of that.
    stamp = readStamp();
    if (!stamp) die('--no-build, but dist/ carries no verify build stamp (built outside launch, or by a failed build): drop --no-build');
    if (stamp.tree !== fingerprint()) die(`--no-build, but dist/ was built from tree ${stamp.tree} and the checkout is now ${fingerprint()}: drop --no-build`);
  }
  const port = Number(flags.port) || (await freePort());
  mkdirSync(runDir(id), { recursive: true });
  const log = join(runDir(id), 'server.log');
  const child = spawn(process.execPath, [join(import.meta.dirname, 'server.mjs'), `--root=${root}`, `--port=${port}`, `--run=${id}`, `--sleeper=${sleeper}`], { detached: true, stdio: ['ignore', openSync(log, 'a'), openSync(log, 'a')], env: process.env });
  child.unref();
  const state = { id, pid: child.pid, port, url: `http://127.0.0.1:${port}`, sha: stamp.sha, tree: stamp.tree, startedAt: new Date().toISOString(), sleeper };
  writeFileSync(statePath(id), JSON.stringify(state, null, 2));
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const h = await (await fetch(`${state.url}/__verify/health`)).json();
      const b = await fetch(`${state.url}/.netlify/functions/bets?season=2024`);
      if (h.pid === child.pid && b.ok) { console.log(`✓ ready ${state.url}  run=${id}  pid=${child.pid}  sha=${stamp.sha}  tree=${stamp.tree}  sleeper=${sleeper}`); return; }
    } catch { /* not up yet */ }
    if (!alive(child.pid)) break;
  }
  die(`server did not become ready; see ${log}`);
}

async function doctor() {
  const id = runId();
  const s = loadState(id);
  const rows = [];
  const check = (ok, what) => { rows.push(`${ok ? '✓' : '✗'} ${what}`); return ok; };
  if (!check(!!s, `run state ${id ?? '(no live run)'}`)) { console.log(rows.join('\n')); process.exit(1); }
  check(alive(s.pid), `process ${s.pid} alive`);
  let h = null;
  try { h = await (await fetch(`${s.url}/__verify/health`)).json(); } catch { /* down */ }
  check(!!h && h.pid === s.pid && h.app === 'msgffl', `port ${s.port} answered by our pid (${h ? h.pid : 'no answer'})`);
  // What is served is dist/ as it is on disk now: its stamp must be this launch's,
  // and must match the checkout as it is now (a commit, an edit or a revert since
  // launch all change the fingerprint).
  const stamp = readStamp();
  check(!!stamp && stamp.tree === s.tree, `dist/ is the build this run launched (${stamp ? stamp.tree : 'no stamp'} vs ${s.tree}${stamp ? '' : ': rebuilt outside launch'})`);
  const now = fingerprint();
  check(s.tree === now, `checkout unchanged since launch (tree ${now}, launched ${s.tree}${s.tree === now ? '' : ': relaunch to drive the change'})`);
  try { const r = await fetch(`${s.url}/.netlify/functions/bets?season=2024`); check(r.ok, `bets function answers ${r.status}`); } catch { check(false, 'bets function answers'); }
  const c = cacheInfo();
  rows.push(`· sleeper ${s.sleeper} (set at launch): ${c.entries} cached responses in ${c.dir}${c.oldest ? `, oldest ${c.oldest}` : ''}${s.sleeper === 'cache' ? `, refetched after ${c.ttlHours} h` : ''}`);
  console.log(rows.join('\n'));
  process.exit(rows.some((r) => r.startsWith('✗')) ? 1 : 0);
}

async function drive() {
  const s = loadState(runId());
  if (!s || !alive(s.pid)) die('no live instance; run launch first');
  if (process.env.VERIFY_SLEEPER && process.env.VERIFY_SLEEPER !== s.sleeper)
    die(`VERIFY_SLEEPER=${process.env.VERIFY_SLEEPER}, but run ${s.id} launched with ${s.sleeper}: the mode is set once, at launch`);
  const { setMode } = await import('./sleeper-cache.mjs');
  setMode(s.sleeper);
  const { run } = await import('./journeys.mjs');
  const names = positional.length ? positional : ['all'];
  const ok = await run(s, names, { headed: !!flags.headed });
  process.exit(ok ? 0 : 1);
}

async function snapshot() {
  const s = loadState(runId());
  if (!s) die('no live instance');
  const { setMode } = await import('./sleeper-cache.mjs');
  setMode(s.sleeper);
  const { snapshotPage } = await import('./journeys.mjs');
  await snapshotPage(s, positional[0] || '/');
}

function cleanup() {
  const runs = join(home(), 'runs');
  const ids = flags.all ? (existsSync(runs) ? readdirSync(runs).filter((x) => existsSync(statePath(x))) : []) : [runId()].filter(Boolean);
  for (const id of ids) {
    const s = loadState(id);
    if (!s) continue;
    if (alive(s.pid)) { try { process.kill(-s.pid, 'SIGTERM'); } catch { process.kill(s.pid, 'SIGTERM'); } }
    rmSync(statePath(id));
    console.log(`✓ stopped run ${id} (pid ${s.pid}); evidence kept in ${runDir(id)}`);
  }
  if (!ids.length) console.log('nothing to clean up');
}

function url() {
  const s = loadState(runId());
  if (!s) die('no live instance');
  console.log(s.url);
}

const cmds = { launch, doctor, drive, snapshot, url, cleanup };
if (!cmds[cmd]) die('usage: [VERIFY_SLEEPER=cache|replay|live] verify.mjs launch [--no-build] [--run=ID] [--port=N] | doctor | drive [journey…] [--headed] | snapshot <path> | url | cleanup [--run=ID|--all]');
await cmds[cmd]();
