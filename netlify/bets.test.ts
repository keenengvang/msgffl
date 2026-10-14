import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBetsHandler } from './lib/betsHandler';
import { memoryBetStore } from './lib/betStore';
import type { FactsFor } from './lib/betFacts';
import type { BetRecord } from '@/entities/bet/model/types';

const URL_ = 'http://local/.netlify/functions/bets';

const draft = { season: '2025', week: 6, sideA: 'ua', sideB: 'ub', stakes: 'a keg', terms: { kind: 'matchup' } };

function setup(opts: { locked?: (week: number) => boolean; down?: boolean } = {}) {
  const store = memoryBetStore();
  const facts: FactsFor = async (season, week) => {
    if (opts.down) throw new Error('sleeper down');
    if (season !== '2025') return null;
    return { members: new Set(['ua', 'ub', 'uc']), locked: () => opts.locked?.(week) ?? false };
  };
  const handler = makeBetsHandler({ store: () => store, facts, now: () => new Date('2025-10-10T12:00:00Z') });
  return { store, handler };
}

const req = (method: string, body?: unknown, qs = '', headers: Record<string, string> = {}) =>
  new Request(`${URL_}${qs}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-bets-pin': '1234', 'x-nf-client-connection-ip': '1.1.1.1', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function create(handler: ReturnType<typeof setup>['handler'], over = {}) {
  const res = await handler(req('POST', { bet: { ...draft, ...over }, by: 'Keeneng' }));
  expect(res.status).toBe(201);
  return ((await res.json()) as { bet: BetRecord }).bet;
}

const patch = (bet: BetRecord, p: unknown, version = bet.version) =>
  req('PATCH', { patch: p, version, by: 'Mike' }, `?season=${bet.season}&id=${bet.id}`);

describe('bets function', () => {
  beforeEach(() => vi.stubEnv('BETS_PIN', '1234'));
  afterEach(() => vi.unstubAllEnvs());

  it('creates a bet with server-owned fields and lists it publicly', async () => {
    const { handler } = setup();
    const bet = await create(handler);
    expect(bet).toMatchObject({
      ...draft,
      winner: null,
      paidTo: null,
      createdBy: 'Keeneng',
      createdAt: '2025-10-10T12:00:00.000Z',
      deletedAt: null,
    });
    expect(bet.id).toMatch(/^[\w-]+$/);
    expect(bet.version).toBeTruthy();

    const list = await handler(new Request(`${URL_}?season=2025`));
    expect(list.status).toBe(200);
    expect(((await list.json()) as { bets: BetRecord[] }).bets.map((b) => b.id)).toEqual([bet.id]);
    // no season = the full export
    expect(((await (await handler(new Request(URL_))).json()) as { bets: unknown[] }).bets).toHaveLength(1);
  });

  it('gates writes on the PIN and brakes guessing', async () => {
    const { handler } = setup();
    expect((await handler(req('POST', { bet: draft, by: 'x' }, '', { 'x-bets-pin': 'nope' }))).status).toBe(401);
    for (let i = 0; i < 9; i++) await handler(req('POST', { bet: draft, by: 'x' }, '', { 'x-bets-pin': `g${i}`, 'x-nf-client-connection-ip': '6.6.6.6' }));
    const res = await handler(req('POST', { bet: draft, by: 'x' }, '', { 'x-bets-pin': '1234', 'x-nf-client-connection-ip': '6.6.6.6' }));
    expect(res.status).toBe(201); // 9 misses: still allowed
    await handler(req('POST', { bet: draft, by: 'x' }, '', { 'x-bets-pin': 'g9', 'x-nf-client-connection-ip': '6.6.6.6' }));
    expect((await handler(req('POST', { bet: draft, by: 'x' }, '', { 'x-nf-client-connection-ip': '6.6.6.6' }))).status).toBe(429);
  });

  it('500s when BETS_PIN is not configured, 405s other methods', async () => {
    const { handler } = setup();
    expect((await handler(req('DELETE'))).status).toBe(405);
    vi.stubEnv('BETS_PIN', '');
    expect((await handler(req('POST', { bet: draft, by: 'x' }))).status).toBe(500);
  });

  it('validates the bet, the actor, and league membership', async () => {
    const { handler } = setup();
    expect((await handler(req('POST', { bet: { ...draft, sideB: 'ua' }, by: 'x' }))).status).toBe(400);
    expect((await handler(req('POST', { bet: draft, by: ' ' }))).status).toBe(400);
    expect((await handler(req('POST', { bet: { ...draft, sideB: 'stranger' }, by: 'x' }))).status).toBe(400);
    expect((await handler(req('POST', { bet: { ...draft, season: '2019' }, by: 'x' }))).status).toBe(400);
  });

  it('refuses to open a bet on a game that already kicked off, and fails closed when Sleeper is down', async () => {
    expect((await setup({ locked: () => true }).handler(req('POST', { bet: draft, by: 'x' }))).status).toBe(423);
    const down = setup({ down: true });
    expect((await down.handler(req('POST', { bet: draft, by: 'x' }))).status).toBe(503);
    expect(down.store.size()).toBe(0);
  });

  it('edits with the current version and rejects a stale one', async () => {
    const { handler } = setup();
    const bet = await create(handler);
    const res = await handler(patch(bet, { stakes: 'two kegs' }));
    expect(res.status).toBe(200);
    const edited = ((await res.json()) as { bet: BetRecord }).bet;
    expect(edited).toMatchObject({ stakes: 'two kegs', updatedBy: 'Mike', createdBy: 'Keeneng' });
    expect(edited.version).not.toBe(bet.version);

    const stale = await handler(patch(bet, { stakes: 'a high noon' }));
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as { bet: BetRecord }).bet.stakes).toBe('two kegs');
  });

  it('freezes the wager once live, but still lets you settle up', async () => {
    let live = false;
    const { handler } = setup({ locked: () => live });
    let bet = await create(handler, { terms: { kind: 'custom', text: 'first to bench a 0' } });
    live = true;
    expect((await handler(patch(bet, { stakes: 'a high noon' }))).status).toBe(423);

    let res = await handler(patch(bet, { winner: 'B' }));
    expect(res.status).toBe(200);
    bet = ((await res.json()) as { bet: BetRecord }).bet;
    res = await handler(patch(bet, { paidTo: 'B' }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { bet: BetRecord }).bet).toMatchObject({ winner: 'B', paidTo: 'B', stakes: 'a keg' });
  });

  it("won't move an open bet into a week that's already started", async () => {
    const { handler } = setup({ locked: (w) => w === 5 });
    const bet = await create(handler);
    expect((await handler(patch(bet, { week: 5 }))).status).toBe(423);
    expect((await handler(patch(bet, { sideB: 'ua' }))).status).toBe(400);
  });

  it('matchup bets take no manual ruling', async () => {
    const { handler } = setup();
    const bet = await create(handler);
    expect((await handler(patch(bet, { winner: 'A' }))).status).toBe(400);
  });

  it('delete is a tombstone, and restorable', async () => {
    const { handler, store } = setup();
    const bet = await create(handler);
    let res = await handler(patch(bet, { deleted: true }));
    const gone = ((await res.json()) as { bet: BetRecord }).bet;
    expect(gone).toMatchObject({ deletedBy: 'Mike', deletedAt: '2025-10-10T12:00:00.000Z' });
    expect(store.size()).toBe(1);

    res = await handler(patch(gone, { deleted: false }));
    expect(((await res.json()) as { bet: BetRecord }).bet).toMatchObject({ deletedAt: null, deletedBy: null });
  });

  it('404s an unknown bet and 400s a malformed address', async () => {
    const { handler } = setup();
    const bet = await create(handler);
    expect((await handler(req('PATCH', { patch: { paidTo: 'A' }, version: 'v1', by: 'x' }, '?season=2025&id=nope'))).status).toBe(404);
    expect((await handler(req('PATCH', { patch: { paidTo: 'A' }, version: 'v1', by: 'x' }, '?season=../&id=x'))).status).toBe(400);
    expect((await handler(req('PATCH', { patch: { paidTo: 'A' }, by: 'x' }, `?season=2025&id=${bet.id}`))).status).toBe(400);
  });
});
