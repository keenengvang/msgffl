import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSnapshot } from './fixture';

// The handler talks to Claude through the SDK, so the SDK is what we fake.
const create = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    constructor(public status: number) {
      super(`api error ${status}`);
    }
  }
  return {
    default: class {
      messages = { create };
      static APIError = APIError;
    },
  };
});

// League data would otherwise mean ~80 live Sleeper requests per test.
const snapshot = vi.fn(async () => makeSnapshot());
vi.mock('./lib/league', async (orig) => ({
  ...(await orig<typeof import('./lib/league')>()),
  snapshot: (...args: []) => snapshot(...args),
  rostersFor: vi.fn(async () => ({ rosters: [], users: [] })),
}));
vi.mock('./lib/players', () => ({
  playersDb: vi.fn(async () => ({})),
  seasonStats: vi.fn(async () => ({})),
}));

const { default: handler } = await import('./functions/chat');

const post = (body: unknown, ip = '1.2.3.4') =>
  new Request('http://local/.netlify/functions/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': ip },
    body: JSON.stringify(body),
  });

const turn = (content: string) => ({ role: 'user', content });
const say = (text: string) => ({ content: [{ type: 'text', text }] });
const callTool = (name: string, input: unknown) => ({
  content: [{ type: 'tool_use', id: 'tool-1', name, input }],
});

/** The system blocks of the Nth create() call, flattened to one string. */
const systemText = (n = 0): string =>
  (create.mock.calls[n]![0].system as { text: string }[]).map((b) => b.text).join('\n');

describe('chat function', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    create.mockReset();
    snapshot.mockClear();
    snapshot.mockImplementation(async () => makeSnapshot());
    create.mockResolvedValue(say('Start whoever hates you least.'));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects non-POST', async () => {
    expect((await handler(new Request('http://local/', { method: 'GET' }))).status).toBe(405);
  });

  it('500s when the key is not configured', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect((await handler(post({ messages: [turn('hi')] }))).status).toBe(500);
  });

  it('400s on JSON that is not an object, instead of throwing', async () => {
    for (const body of [null, [1, 2], 'hi']) {
      expect((await handler(post(body, '6.6.6.6'))).status).toBe(400);
    }
  });

  it('rejects malformed histories', async () => {
    const bad = [
      { messages: [] },
      { messages: [{ role: 'system', content: 'hi' }] },
      { messages: [{ role: 'user', content: '   ' }] },
      { messages: [{ role: 'user', content: 'x'.repeat(2001) }] },
      { messages: Array.from({ length: 41 }, () => turn('hi')) },
    ];
    for (const body of bad) {
      expect((await handler(post(body, '2.2.2.2'))).status).toBe(400);
    }
  });

  it('relays the full conversation and returns the reply text', async () => {
    const messages = [
      turn('who do I start at QB?'),
      { role: 'assistant', content: 'Anyone but your guy.' },
      turn('rude. elaborate?'),
    ];
    const res = await handler(post({ messages }, '3.3.3.3'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: 'Start whoever hates you least.' });
    expect(create.mock.calls[0]![0].messages).toEqual(messages);
  });

  it('surfaces upstream failures as 502', async () => {
    create.mockRejectedValue(new Error('boom'));
    expect((await handler(post({ messages: [turn('hi')] }, '4.4.4.4'))).status).toBe(502);
  });

  it('rate limits a chatty IP', async () => {
    for (let i = 0; i < 30; i++) {
      expect((await handler(post({ messages: [turn(`q${i}`)] }, '5.5.5.5'))).status).toBe(200);
    }
    expect((await handler(post({ messages: [turn('one more')] }, '5.5.5.5'))).status).toBe(429);
  });

  describe('league knowledge', () => {
    it('sends the brief and the tools with every question', async () => {
      await handler(post({ messages: [turn("who's winning?")] }, '7.7.7.1'));

      const system = systemText();
      expect(system).toContain('LEAGUE BRIEF');
      expect(system).toContain('2024 STANDINGS');
      expect(system).toContain('Boom Squad');
      expect(create.mock.calls[0]![0].tools.map((t: { name: string }) => t.name)).toContain('get_team');
    });

    it('caches the brief so a long thread does not re-bill it', async () => {
      await handler(post({ messages: [turn('hi')] }, '7.7.7.2'));
      const blocks = create.mock.calls[0]![0].system as { cache_control?: unknown }[];
      expect(blocks.at(-1)!.cache_control).toEqual({ type: 'ephemeral' });
    });

    it('runs a tool call and feeds the result back', async () => {
      create.mockResolvedValueOnce(callTool('get_season', { season: '2023' }));
      create.mockResolvedValueOnce(say('Boom Squad took it, obviously.'));

      const res = await handler(post({ messages: [turn('who won in 2023?')] }, '7.7.7.3'));

      expect(await res.json()).toEqual({ text: 'Boom Squad took it, obviously.' });
      expect(create).toHaveBeenCalledTimes(2);
      const followUp = create.mock.calls[1]![0].messages;
      // The tool_result must ride in a single user message, or the model quietly
      // stops making parallel calls.
      expect(followUp.at(-1).role).toBe('user');
      expect(followUp.at(-1).content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'tool-1' });
      expect(followUp.at(-1).content[0].content).toContain('Boom Squad');
    });

    it('marks a failed tool call as an error result instead of 502ing', async () => {
      create.mockResolvedValueOnce(callTool('get_season', { season: '1999' }));
      create.mockResolvedValueOnce(say('No such season, champ.'));

      await handler(post({ messages: [turn('who won in 1999?')] }, '7.7.7.4'));

      expect(create.mock.calls[1]![0].messages.at(-1).content[0]).toMatchObject({ is_error: true });
    });

    it('stops looping if the model keeps calling tools, and drops the tools last', async () => {
      create.mockResolvedValue(callTool('get_season', { season: '2023' }));

      const res = await handler(post({ messages: [turn('loop forever')] }, '7.7.7.5'));

      expect(res.status).toBe(200);
      expect(create).toHaveBeenCalledTimes(5); // MAX_TOOL_ROUNDS + the final toolless call
      expect(create.mock.calls.at(-1)![0].tools).toBeUndefined();
    });

    it('clamps a reply to the per-message cap so it can be replayed as history', async () => {
      // max_tokens allows far more prose than MAX_CHARS. An over-long reply
      // would be stored by the browser and rejected by parseMessages on the
      // NEXT question, bricking the thread.
      create.mockResolvedValueOnce(say('word. '.repeat(600))); // ~3600 chars

      const res = await handler(post({ messages: [turn('go on')] }, '7.7.7.9'));
      const { text } = (await res.json()) as { text: string };

      expect(text.length).toBeLessThanOrEqual(2000);
      expect(text.endsWith('…')).toBe(true);
      // Round-trips: the clamped reply is a valid turn on the next request.
      create.mockClear();
      const next = await handler(
        post({ messages: [turn('go on'), { role: 'assistant', content: text }, turn('and?')] }, '7.7.8.0'),
      );
      expect(next.status).toBe(200);
    });

    it('leaves a short reply untouched', async () => {
      create.mockResolvedValue(say('Short and rude.'));
      const res = await handler(post({ messages: [turn('hi')] }, '7.7.8.1'));
      expect(await res.json()).toEqual({ text: 'Short and rude.' });
    });

    it('still answers when Sleeper is down, and says the data is missing', async () => {
      snapshot.mockRejectedValue(new Error('sleeper is having a day'));

      const res = await handler(post({ messages: [turn("who's first?")] }, '7.7.7.6'));

      expect(res.status).toBe(200);
      expect(systemText()).toContain('unavailable');
      expect(create.mock.calls[0]![0].tools).toBeUndefined();
    });

    it('matches the persona to the site snark toggle', async () => {
      await handler(post({ messages: [turn('hi')], snark: 'polite' }, '7.7.7.7'));
      expect(systemText()).toContain('friendly, knowledgeable');

      create.mockClear();
      await handler(post({ messages: [turn('hi')], snark: 'savage' }, '7.7.7.8'));
      expect(systemText()).toContain('respects nobody');
    });
  });
});
