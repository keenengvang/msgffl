/**
 * Suggestion box → GitHub issue.
 * POST { who, text } → creates a labeled issue on the league repo; Notion's
 * GitHub connector mirrors it from there. GITHUB_TOKEN is a fine-grained PAT
 * (this repo only, Issues: read/write) set in the Netlify UI — never in code.
 */

const REPO = process.env.GITHUB_REPO ?? 'keenengvang/msgffl';

const MAX_TEXT = 1000;
const MAX_WHO = 50;

// Best-effort rate limit (per warm function instance).
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const token = process.env.GITHUB_TOKEN;
  if (!token) return json(500, { error: 'suggestion box not configured (missing GITHUB_TOKEN)' });

  const ip = req.headers.get('x-nf-client-connection-ip') ?? 'unknown';
  if (rateLimited(ip)) return json(429, { error: 'easy, champ. the docket can wait an hour.' });

  let payload: { who?: unknown; text?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'invalid JSON' });
  }

  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  const who = (typeof payload.who === 'string' && payload.who.trim()) || 'ANONYMOUS COWARD';
  if (!text) return json(400, { error: 'text is required' });
  if (text.length > MAX_TEXT) return json(400, { error: `text must be ≤ ${MAX_TEXT} chars` });
  if (who.length > MAX_WHO) return json(400, { error: `who must be ≤ ${MAX_WHO} chars` });

  const title = text.length > 80 ? `${text.slice(0, 77)}…` : text;
  const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'msgffl-suggestion-box',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify({
      title,
      body: `${text}\n\n—\nsubmitted by **${who}** via the M$G suggestion box`,
      labels: ['suggestion'],
    }),
  });

  if (!res.ok) return json(502, { error: `github said no (${res.status})` });
  const issue = (await res.json()) as { number: number; html_url: string };
  return json(201, { number: issue.number, url: issue.html_url });
}
