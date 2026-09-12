import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const { default: handler } = await import('./functions/chat');

const post = (body: unknown, ip = '1.2.3.4') =>
  new Request('http://local/.netlify/functions/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': ip },
    body: JSON.stringify(body),
  });

const turn = (content: string) => ({ role: 'user', content });

describe('chat function', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    create.mockReset();
    create.mockResolvedValue({ content: [{ type: 'text', text: 'Start whoever hates you least.' }] });
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
});
