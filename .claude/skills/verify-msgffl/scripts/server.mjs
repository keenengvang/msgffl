// The local stand-in for Netlify. Started by `verify.mjs launch`; never run it
// by hand against a shared port.
//   - dist/ with netlify.toml's exact-path redirects and the SPA fallback
//   - /.netlify/functions/bets: the REAL entry, netlify/functions/bets.ts
//     (blobsBetStore + sleeperFacts), over a local Netlify BlobsServer whose
//     files live in <run>/blobs (see ReadEtagBlobsServer for what is local)
//   - /.netlify/functions/suggest: the REAL entry; its GitHub call lands in a
//     fake that appends each issue it would file to <run>/github-outbox.jsonl
//   - /.netlify/functions/chat: 503 (it would spend Anthropic credit)
// Every outbound host but Sleeper (through the disk cache), the fake GitHub and
// the local BlobsServer is refused, so nothing here reaches GitHub or Anthropic.
// The functions rate-limit per client IP; each drive sends its own
// x-verify-client id, used as that IP, so reruns in one launch never share a bucket.
import { createServer as createHttp } from 'node:http';
import { readFileSync, existsSync, statSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { createServer as createVite } from 'vite';
import { BlobsServer } from '@netlify/blobs/server';
import { patchNodeFetch, setMode, SLEEPER } from './sleeper-cache.mjs';
import { runDir } from './paths.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const root = args.root;
const port = Number(args.port);
const dist = join(root, 'dist');
setMode(args.sleeper);

// Netlify Blobs, locally: the real store's own server, its files under the run.
const blobsDir = join(runDir(args.run), 'blobs');
mkdirSync(blobsDir, { recursive: true });
// Two gaps between the local server (@netlify/blobs 11.1.4) and the hosted
// service, both closed here:
//  - reads: the hosted service sends a blob's etag on every read, and
//    blobsBetStore relies on it (no etag reads as "no such bet"); the local
//    server only returns etags from writes. Add the one it computes for writes.
//  - conditional writes: the local put() checks If-Match, then awaits the
//    write, with nothing holding the key in between, so two writes carrying the
//    same etag both succeed. Writes to one key are queued here, so the second
//    sees the first's etag and gets 412, as an atomic compare-and-set would.
// What stays local: the etag is the server's HMAC of the file's path and
// mtime (two writes in one millisecond would share one), and there is no
// replication, so cross-region consistency is not exercised.
class ReadEtagBlobsServer extends BlobsServer {
  #keyQueues = new Map();
  async put(req) {
    const { dataPath } = this.getLocalPaths(new URL(req.url ?? '', this.address));
    if (!dataPath) return super.put(req);
    const prev = this.#keyQueues.get(dataPath) ?? Promise.resolve();
    const run = prev.then(() => super.put(req));
    const settled = run.then(() => {}, () => {});
    this.#keyQueues.set(dataPath, settled);
    settled.then(() => { if (this.#keyQueues.get(dataPath) === settled) this.#keyQueues.delete(dataPath); });
    return run;
  }

  async get(req) {
    const res = await super.get(req);
    if (res.status !== 200 || res.headers.has('etag')) return res;
    const api = this.parseAPIRequest(req);
    const { dataPath, key } = this.getLocalPaths(api?.url ?? new URL(req.url ?? '', this.address));
    if (!key || !dataPath) return res;
    const headers = new Headers(res.headers);
    headers.set('etag', await BlobsServer.generateETag(dataPath));
    return new Response(res.body, { status: res.status, headers });
  }
}
const blobs = new ReadEtagBlobsServer({ directory: blobsDir, token: 'verify-msgffl' });
const { port: blobsPort } = await blobs.start();
const blobsURL = `http://127.0.0.1:${blobsPort}`;
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(
  JSON.stringify({ siteID: 'verify-msgffl', token: 'verify-msgffl', edgeURL: blobsURL, uncachedEdgeURL: blobsURL }),
).toString('base64');

process.env.GITHUB_TOKEN = 'verify-msgffl-dummy';
process.env.GITHUB_REPO = 'verify-msgffl/sandbox';
let githubDown = false;
let issueNo = 0;
const outbox = join(runDir(args.run), 'github-outbox.jsonl');
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url ?? String(input);
  if (url.startsWith(SLEEPER) || url.startsWith(blobsURL)) return realFetch(input, init);
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
const { default: bets } = await vite.ssrLoadModule('/netlify/functions/bets.ts');
const { default: suggest } = await vite.ssrLoadModule('/netlify/functions/suggest.ts');

// netlify.toml's exact-path redirects (the /* → /index.html 200 is the SPA fallback below).
const redirects = [...readFileSync(join(root, 'netlify.toml'), 'utf8').matchAll(/\[\[redirects\]\]\s*from\s*=\s*"([^"]+)"\s*to\s*=\s*"([^"]+)"\s*status\s*=\s*(\d+)/g)]
  .map(([, from, to, status]) => ({ from, to, status: Number(status) }))
  .filter((r) => !r.from.includes('*') && r.status >= 300 && r.status < 400);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.txt': 'text/plain', '.woff2': 'font/woff2' };

async function call(nodeReq, res, handler) {
  const chunks = [];
  for await (const c of nodeReq) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const client = String(nodeReq.headers['x-verify-client'] || '127.0.0.1');
  const req = new Request(`http://127.0.0.1:${port}${nodeReq.url}`, {
    method: nodeReq.method,
    headers: { ...nodeReq.headers, 'x-nf-client-connection-ip': client },
    body: nodeReq.method === 'GET' || nodeReq.method === 'HEAD' ? undefined : body,
  });
  const r = await handler(req);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

createHttp(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/__verify/health') return json(res, 200, { app: 'msgffl', pid: process.pid, run: args.run, sleeper: args.sleeper, bets: 'netlify/functions/bets.ts over BlobsServer' });
    if (url.pathname === '/__verify/github') {
      githubDown = url.searchParams.get('down') === '1';
      return json(res, 200, { githubDown });
    }
    if (url.pathname === '/.netlify/functions/bets') return await call(req, res, bets);
    if (url.pathname === '/.netlify/functions/suggest') return await call(req, res, suggest);
    if (url.pathname.startsWith('/.netlify/functions/')) return json(res, 503, { error: 'not served by verify-msgffl (would reach Anthropic)' });
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
}).listen(port, '127.0.0.1', () => console.log(`verify-msgffl ready on http://127.0.0.1:${port} pid=${process.pid} blobs=${blobsURL}`));
