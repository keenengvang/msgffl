/**
 * League chatbot → Claude.
 * POST { messages: [{role, content}, …], snark? } → { text }. The whole
 * conversation is sent every call because the Messages API is stateless; the
 * browser owns the history, this function just relays it. ANTHROPIC_API_KEY is
 * set in the Netlify UI — never in code, never in a VITE_ var (those ship to
 * the browser).
 *
 * The analyst knows the league two ways. A rendered brief (standings, all-time,
 * champions, record book, this week's games) rides in the system prompt on
 * every turn, so most questions are answered with zero tool calls — which is
 * what keeps this inside Netlify's synchronous timeout. The tools in
 * netlify/lib/tools.ts cover what the brief can't hold: one team in depth, an
 * arbitrary week, a rivalry, a player. Both are built from the same pure
 * functions the site renders from, so the bot can't contradict the page.
 */
import Anthropic from '@anthropic-ai/sdk';
import { leagueBrief } from '../lib/brief';
import { snapshot } from '../lib/league';
import { runTool, TOOLS } from '../lib/tools';

/* Tool use is a multi-hop join (resolve a name → read a season → compare), and
   Haiku fumbles that chain often enough to be worth the difference. Swap this
   one line back to 'claude-haiku-4-5' if the bill says otherwise. */
const MODEL = 'claude-sonnet-5';

const MAX_TURNS = 40; // whole conversation
const MAX_CHARS = 2000; // per message
const MAX_TOOL_ROUNDS = 4; // tool → answer hops before we cut it off
const DEADLINE_MS = 8_500; // leave headroom inside Netlify's ~10s function cap

const PERSONA = {
  savage:
    'You are the M$G Fantasy Football League analyst: a sarcastic, very funny football ' +
    'commentator who has watched this league since 2012 and respects nobody in it. Roast freely — ' +
    'the banter is the point — but never invent a number to land a joke.',
  polite:
    'You are the M$G Fantasy Football League analyst: a friendly, knowledgeable football ' +
    'commentator who has followed this league since 2012. Keep it warm and plain-spoken, and ' +
    'never invent a number.',
};

const RULES = [
  'The LEAGUE BRIEF below is live data for this league. Answer from it whenever it has the answer.',
  'Call a tool only for what the brief does not contain: one manager in depth, a week other than the current one, a specific rivalry, a past season, or a player.',
  'Every number you state must come from the brief or a tool result. If you do not have it, say so — do not estimate, and do not reason about NFL players or games you were not given data for.',
  'When a team name is ambiguous, the tool hands you the candidates: ask the user which manager they meant.',
  'You do not know which manager the user is. If they say "I", "me" or "my team" — "who do I play this week?" — ask which team is theirs, then answer for that team. Do not pick one.',
  'This is a 14-team league. The champion comes from the winners bracket, not the standings. Head-to-head records are regular season only.',
  'Keep answers short — this renders in a small chat panel. Two or three sentences unless asked for more.',
].join('\n');

/* Best-effort rate limit (per warm function instance), same shape as suggest.ts. */
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

/** The system prompt: persona, rules, then the brief. The cache breakpoint sits
    on the last block, so tools + persona + rules + brief are all one cached
    prefix — it only moves when the live week re-reads. */
function systemFor(snark: 'savage' | 'polite', brief: string | null): Anthropic.TextBlockParam[] {
  const head = `${PERSONA[snark]}\n\n${RULES}`;
  if (!brief) {
    return [
      {
        type: 'text',
        text: `${head}\n\nLEAGUE BRIEF: unavailable — Sleeper did not answer. Tell the user the league data is down rather than guessing at it.`,
      },
    ];
  }
  return [
    { type: 'text', text: head },
    { type: 'text', text: `LEAGUE BRIEF\n${brief}`, cache_control: { type: 'ephemeral' } },
  ];
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

  const body = payload as { messages?: unknown; snark?: unknown };
  const messages = parseMessages(body.messages);
  if (!messages) return json(400, { error: 'messages must be 1–40 turns of {role, content}' });
  const snark = body.snark === 'polite' ? 'polite' : 'savage';

  // League data is best-effort: if Sleeper is down the analyst still talks, it
  // just says so instead of inventing a standings table.
  const snap = await snapshot().catch((err) => {
    console.error('league snapshot failed', err);
    return null;
  });

  const client = new Anthropic({ apiKey });
  const system = systemFor(snark, snap ? leagueBrief(snap) : null);
  const thread: Anthropic.MessageParam[] = [...messages];
  const deadline = Date.now() + DEADLINE_MS;

  try {
    let text = '';
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      // Past the deadline, drop the tools so the model has to answer in words
      // rather than starting another round we don't have time to finish.
      const outOfTime = Date.now() > deadline;
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system,
        messages: thread,
        ...(snap && !outOfTime && round < MAX_TOOL_ROUNDS ? { tools: TOOLS } : {}),
      });

      text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

      const calls = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      if (calls.length === 0 || !snap) break;

      thread.push({ role: 'assistant', content: message.content });
      // Parallel calls must come back as tool_result blocks in ONE user message,
      // or the model quietly stops making parallel calls.
      const results = await Promise.all(
        calls.map(async (call): Promise<Anthropic.ToolResultBlockParam> => {
          const outcome = await runTool(call.name, call.input, snap);
          return {
            type: 'tool_result',
            tool_use_id: call.id,
            content: outcome.content,
            ...(outcome.isError ? { is_error: true } : {}),
          };
        }),
      );
      thread.push({ role: 'user', content: results });
    }

    return json(200, {
      text: text || "The analyst went quiet. Ask that again, maybe with fewer moving parts.",
    });
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status : undefined;
    // Don't leak the upstream error text to the browser; log it for the Netlify console.
    console.error('anthropic call failed', err);
    return json(502, { error: `the analyst choked${status ? ` (${status})` : ''}` });
  }
}
