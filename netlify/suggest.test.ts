import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './functions/suggest';

const post = (body: unknown, ip = '1.2.3.4') =>
  new Request('http://local/.netlify/functions/suggest', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': ip },
    body: JSON.stringify(body),
  });

describe('suggest function', () => {
  beforeEach(() => {
    vi.stubEnv('GITHUB_TOKEN', 'test-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ number: 42, html_url: 'https://github.com/x/y/issues/42' }), {
          status: 201,
        }),
      ),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects non-POST and missing text', async () => {
    expect((await handler(new Request('http://local/', { method: 'GET' }))).status).toBe(405);
    expect((await handler(post({ who: 'a', text: '   ' }))).status).toBe(400);
  });

  it('500s when the token is not configured', async () => {
    vi.stubEnv('GITHUB_TOKEN', '');
    expect((await handler(post({ text: 'two flex spots' }))).status).toBe(500);
  });

  it('creates a labeled issue with title, body attribution, and returns 201', async () => {
    const res = await handler(post({ who: 'Keeneng', text: 'two flex spots' }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ number: 42, url: 'https://github.com/x/y/issues/42' });

    const call = vi.mocked(fetch).mock.calls[0]!;
    expect(String(call[0])).toContain('/repos/');
    const sent = JSON.parse(String(call[1]!.body));
    expect(sent.title).toBe('two flex spots');
    expect(sent.body).toContain('submitted by **Keeneng**');
    expect(sent.labels).toEqual(['suggestion']);
  });

  it('ellipsizes long titles and defaults anonymous submitters', async () => {
    const long = 'x'.repeat(200);
    await handler(post({ text: long }, '9.9.9.9'));
    const sent = JSON.parse(String(vi.mocked(fetch).mock.calls[0]![1]!.body));
    expect(sent.title.length).toBeLessThanOrEqual(80);
    expect(sent.title.endsWith('…')).toBe(true);
    expect(sent.body).toContain('**ANONYMOUS COWARD**');
  });

  it('rate limits a chatty IP and surfaces GitHub failures as 502', async () => {
    for (let i = 0; i < 5; i++) expect((await handler(post({ text: `s${i}` }, '5.5.5.5'))).status).toBe(201);
    expect((await handler(post({ text: 'one more' }, '5.5.5.5'))).status).toBe(429);

    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })));
    expect((await handler(post({ text: 'bad token' }, '7.7.7.7'))).status).toBe(502);
  });
});
