// The local stand-in for Netlify: serves the built dist/ with the SPA fallback
// from netlify.toml, and /.netlify/functions/bets with the REAL handler
// (netlify/lib/betsHandler.ts) over an in-memory store and the real
// sleeperFacts (Sleeper through the disk cache), and /.netlify/functions/suggest
// with the REAL handler whose GitHub call lands in a fake: each issue it would
// file is appended to <run>/github-outbox.jsonl instead. Every other outbound
// host is refused, so nothing here can reach GitHub or Anthropic. chat answers
// 503 (it would spend Anthropic credit); it is not covered locally.
// Started by `verify.mjs launch`; never run it by hand against a shared port.
import { createServer as createHttp } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { createServer as createVite } from 'vite';
import { patchNodeFetch, SLEEPER } from './sleeper-cache.mjs';
import { appendFileSync } from 'node:fs';
import { runDir } from './paths.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const root = args.root;
const port = Number(args.port);
const dist = join(root, 'dist');

process.env.GITHUB_TOKEN = 'verify-msgffl-dummy';
process.env.GITHUB_REPO = 'verify-msgffl/sandbox';
let githubDown = false;
let issueNo = 0;
const outbox = join(runDir(args.run), 'github-outbox.jsonl');
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url ?? String(input);
  if (url.startsWith(SLEEPER)) return realFetch(input, init);
  if (url === 'https://api.github.com/repos/verify-msgffl/sandbox/issues' && init?.method === 'POST') {
    if (githubDown) return new Response('{"message":"verify-msgffl: github down"}', { status: 500 });
    const issue = { number: ++issueNo, html_url: `https://github.com/verify-msgffl/sandbox/issues/${issueNo}` };
    appendFileSync(outbox, JSON.stringify({ at: new Date().toISOString(), request: JSON.parse(init.body), issue }) + '\n');
    return new Response(JSON.stringify(issue), { status: 201, headers: { 'content-type': 'application/json' } });
  }
  throw new Error(`verify-msgffl refuses outbound ${url}`);
};
patchNodeFetch(); // Sleeper GETs → disk cache, on top of the guard above
const vite = await createVite({ root, configFile: join(root, 'vite.config.ts'), server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
const { makeBetsHandler } = await vite.ssrLoadModule('/netlify/lib/betsHandler.ts');
const { memoryBetStore } = await vite.ssrLoadModule('/netlify/lib/betStore.ts');
const { sleeperFacts } = await vite.ssrLoadModule('/netlify/lib/betFacts.ts');
const store = memoryBetStore(); // one instance for the life of this server: a reload must read back what was written
const bets = makeBetsHandler({ store: () => store, facts: sleeperFacts });
const { default: suggest } = await vite.ssrLoadModule('/netlify/functions/suggest.ts');

// netlify.toml's exact-path redirects (the /* → /index.html 200 is the SPA fallback below).
const redirects = [...readFileSync(join(root, 'netlify.toml'), 'utf8').matchAll(/\[\[redirects\]\]\s*from\s*=\s*"([^"]+)"\s*to\s*=\s*"([^"]+)"\s*status\s*=\s*(\d+)/g)]
  .map(([, from, to, status]) => ({ from, to, status: Number(status) }))
  .filter((r) => !r.from.includes('*') && r.status >= 300 && r.status < 400);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.txt': 'text/plain', '.woff2': 'font/woff2' };

async function toResponse(nodeReq, handler) {
  const chunks = [];
  for await (const c of nodeReq) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const req = new Request(`http://127.0.0.1:${port}${nodeReq.url}`, {
    method: nodeReq.method,
    headers: { ...nodeReq.headers, 'x-nf-client-connection-ip': '127.0.0.1' },
    body: nodeReq.method === 'GET' || nodeReq.method === 'HEAD' ? undefined : body,
  });
  return handler(req);
}

createHttp(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/__verify/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ app: 'msgffl', pid: process.pid, run: args.run, sha: args.sha, bets: store.size() }));
    }
    if (url.pathname === '/.netlify/functions/bets') {
      const r = await toResponse(req, bets);
      res.writeHead(r.status, Object.fromEntries(r.headers));
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    if (url.pathname === '/__verify/github') {
      githubDown = url.searchParams.get('down') === '1';
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ githubDown }));
    }
    if (url.pathname === '/.netlify/functions/suggest') {
      const r = await toResponse(req, suggest);
      res.writeHead(r.status, Object.fromEntries(r.headers));
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    if (url.pathname.startsWith('/.netlify/functions/')) {
      res.writeHead(503, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: 'not served by verify-msgffl (would reach GitHub or Anthropic)' }));
    }
    const hop = redirects.find((r) => r.from === url.pathname);
    if (hop) {
      res.writeHead(hop.status, { location: hop.to + url.search });
      return res.end();
    }
    const p = normalize(join(dist, decodeURIComponent(url.pathname)));
    const file = p.startsWith(dist) && existsSync(p) && statSync(p).isFile() ? p : join(dist, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(String(e?.stack || e));
  }
}).listen(port, '127.0.0.1', () => console.log(`verify-msgffl ready on http://127.0.0.1:${port} pid=${process.pid}`));
