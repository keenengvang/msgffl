/**
 * League chatbot → Claude.
 * POST { messages: [{role, content}, …] } → { text }. The whole conversation is
 * sent every call because the Messages API is stateless; the browser owns the
 * history, this function just relays it. ANTHROPIC_API_KEY is set in the
 * Netlify UI — never in code, never in a VITE_ var (those ship to the browser).
 */
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';
const SYSTEM =
  'You are a snarky football analyst that answers fantasy football questions in a humorous way.';

const MAX_TURNS = 40; // whole conversation
const MAX_CHARS = 2000; // per message

// Best-effort rate limit (per warm function instance), same shape as suggest.ts.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 30;
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

/** Narrow untrusted JSON to the message shape the API expects. */
function parseMessages(raw: unknown): Anthropic.MessageParam[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_TURNS) return null;
  const out: Anthropic.MessageParam[] = [];
  for (const m of raw) {
    if (typeof m !== 'object' || m === null) return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') return null;
    if (typeof content !== 'string' || !content.trim() || content.length > MAX_CHARS) return null;
    out.push({ role, content });
  }
  return out;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(500, { error: 'chat not configured (missing ANTHROPIC_API_KEY)' });

  const ip = req.headers.get('x-nf-client-connection-ip') ?? 'unknown';
  if (rateLimited(ip)) return json(429, { error: 'easy, champ. the analyst needs a breather.' });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'invalid JSON' });
  }
  // `null` and arrays are valid JSON but have no .messages — reading through
  // them would throw past this handler and surface as a platform 500.
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return json(400, { error: 'body must be a JSON object' });
  }

  const messages = parseMessages((payload as { messages?: unknown }).messages);
  if (!messages) return json(400, { error: 'messages must be 1–40 turns of {role, content}' });

  try {
    const message = await new Anthropic({ apiKey }).messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages,
    });
    const block = message.content.find((b) => b.type === 'text');
    return json(200, { text: block?.type === 'text' ? block.text : '' });
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status : undefined;
    // Don't leak the upstream error text to the browser; log it for the Netlify console.
    console.error('anthropic call failed', err);
    return json(502, { error: `the analyst choked${status ? ` (${status})` : ''}` });
  }
}
