#!/usr/bin/env node
// verify-msgffl: launch / doctor / drive / snapshot / cleanup. See ../SKILL.md.
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, openSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { home, repoRoot, runDir } from './paths.mjs';
import { cacheInfo } from './sleeper-cache.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(rest.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const positional = rest.filter((a) => !a.startsWith('--'));
const root = repoRoot();
const statePath = (id) => join(runDir(id), 'state.json');
const die = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };

function latestRun() {
  const d = join(home(), 'runs');
  if (!existsSync(d)) return null;
  const live = readdirSync(d).filter((id) => existsSync(statePath(id))).sort();
  return live.at(-1) ?? null;
}
const runId = () => flags.run || process.env.VERIFY_RUN || latestRun();
const loadState = (id) => (id && existsSync(statePath(id)) ? JSON.parse(readFileSync(statePath(id), 'utf8')) : null);
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const sha = () => execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
const dirty = () => execSync('git status --porcelain -- src netlify index.html public vite.config.ts package.json', { cwd: root }).toString().trim() !== '';

const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

async function launch() {
  const id = flags.run || `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
  if (loadState(id)) die(`run ${id} already has an instance; cleanup first`);
  if (!flags['no-build']) {
    console.log('building (npm run build)…');
    try {
      execSync('npm run build', { cwd: root, stdio: 'pipe' });
    } catch (e) {
      die(`npm run build failed:\n${String(e.stdout).split('\n').slice(-25).join('\n')}${e.stderr}`);
    }
  } else if (!existsSync(join(root, 'dist', 'index.html'))) die('--no-build but dist/ has no index.html');
  const port = Number(flags.port) || (await freePort());
  mkdirSync(runDir(id), { recursive: true });
  const log = join(runDir(id), 'server.log');
  const head = sha();
  const child = spawn(process.execPath, [join(import.meta.dirname, 'server.mjs'), `--root=${root}`, `--port=${port}`, `--run=${id}`, `--sha=${head}`], { detached: true, stdio: ['ignore', openSync(log, 'a'), openSync(log, 'a')], env: process.env });
  child.unref();
  const state = { id, pid: child.pid, port, url: `http://127.0.0.1:${port}`, sha: head, dirty: dirty(), startedAt: new Date().toISOString(), sleeper: cacheInfo().mode };
  writeFileSync(statePath(id), JSON.stringify(state, null, 2));
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const h = await (await fetch(`${state.url}/__verify/health`)).json();
      const b = await fetch(`${state.url}/.netlify/functions/bets?season=2024`);
      if (h.pid === child.pid && b.ok) { console.log(`✓ ready ${state.url}  run=${id}  pid=${child.pid}  sha=${head}${state.dirty ? ' (+uncommitted changes)' : ''}`); return; }
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
  if (!check(!!s, `run state ${id ?? '(none)'}`)) { console.log(rows.join('\n')); process.exit(1); }
  check(alive(s.pid), `process ${s.pid} alive`);
  let h = null;
  try { h = await (await fetch(`${s.url}/__verify/health`)).json(); } catch { /* down */ }
  check(!!h && h.pid === s.pid && h.app === 'msgffl', `port ${s.port} answered by our pid (${h ? h.pid : 'no answer'})`);
  check(s.sha === sha(), `instance built from HEAD ${sha()} (instance: ${s.sha}${s.dirty ? ', had uncommitted changes' : ''})`);
  if (dirty() && !s.dirty) check(false, 'uncommitted app changes since launch: relaunch to drive them');
  try { const r = await fetch(`${s.url}/.netlify/functions/bets?season=2024`); check(r.ok, `bets function answers ${r.status}`); } catch { check(false, 'bets function answers'); }
  const c = cacheInfo();
  rows.push(`· sleeper ${c.mode}: ${c.entries} cached responses in ${c.dir}${c.oldest ? `, oldest ${c.oldest}` : ''}`);
  console.log(rows.join('\n'));
  process.exit(rows.some((r) => r.startsWith('✗')) ? 1 : 0);
}

async function drive() {
  const s = loadState(runId());
  if (!s || !alive(s.pid)) die('no live instance; run launch first');
  const { run } = await import('./journeys.mjs');
  const names = positional.length ? positional : ['all'];
  const ok = await run(s, names, { headed: !!flags.headed });
  process.exit(ok ? 0 : 1);
}

async function snapshot() {
  const s = loadState(runId());
  if (!s) die('no live instance');
  const { snapshotPage } = await import('./journeys.mjs');
  await snapshotPage(s, positional[0] || '/');
}

function cleanup() {
  const ids = flags.all ? readdirSync(join(home(), 'runs')).filter((x) => existsSync(statePath(x))) : [runId()].filter(Boolean);
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
if (!cmds[cmd]) die('usage: verify.mjs launch [--no-build] [--run=ID] [--port=N] | doctor | drive [journey…] [--headed] | snapshot <path> | url | cleanup [--run=ID|--all]');
await cmds[cmd]();
