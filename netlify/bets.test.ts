import { describe, expect, it } from 'vitest';
import { makeBetsHandler } from './lib/betsHandler';
import { memoryBetStore } from './lib/betStore';
import type { FactsFor } from './lib/betFacts';
import type { BetRecord } from '@/entities/bet/model/types';

const URL_ = 'http://local/.netlify/functions/bets';

const draft = {
  season: '2025',
  week: 6,
  sideA: 'ua',
  sideB: 'ub',
  terms: 'If ua loses to ub in Week 6, ua owes ub a keg of Busch Light.',
};

function setup(opts: { down?: boolean; members?: Set<string> } = {}) {
  const store = memoryBetStore();
  const members = opts.members ?? new Set(['ua', 'ub', 'uc']);
  const facts: FactsFor = async (season) => {
    if (opts.down) throw new Error('sleeper down');
    if (season !== '2025') return null;
    return { members, rosterOf: { ua: 1, ub: 2, uc: 3 } };
  };
  const handler = makeBetsHandler({ store: () => store, facts, now: () => new Date('2025-10-10T12:00:00Z') });
  return { store, handler };
}

const req = (method: string, body?: unknown, qs = '', ip = '1.1.1.1') =>
  new Request(`${URL_}${qs}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': ip },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function create(handler: ReturnType<typeof setup>['handler'], over = {}) {
  const res = await handler(req('POST', { bet: { ...draft, ...over } }));
  expect(res.status).toBe(201);
  return ((await res.json()) as { bet: BetRecord }).bet;
}

const patch = (bet: BetRecord, p: unknown, version = bet.version) =>
  req('PATCH', { patch: p, version }, `?season=${bet.season}&id=${bet.id}`);

const bodyBet = async (res: Response) => ((await res.json()) as { bet: BetRecord }).bet;

describe('bets function', () => {
  it('creates a bet with server-owned fields and lists it publicly — no PIN needed', async () => {
    const { handler } = setup();
    const bet = await create(handler);
    expect(bet).toMatchObject({
      ...draft,
      winner: null,
      createdAt: '2025-10-10T12:00:00.000Z',
      deletedAt: null,
      rosterA: 1, // rosters recorded at booking
      rosterB: 2,
    });
    expect(bet.id).toMatch(/^[\w-]+$/);
    expect(bet.version).toBeTruthy();

    const list = await handler(new Request(`${URL_}?season=2025`));
    expect(list.status).toBe(200);
    expect(((await list.json()) as { bets: BetRecord[] }).bets.map((b) => b.id)).toEqual([bet.id]);
    // no season = the full export
    expect(((await (await handler(new Request(URL_))).json()) as { bets: unknown[] }).bets).toHaveLength(1);
  });

  it('rate-limits a spammy IP and 405s other methods', async () => {
    const { handler } = setup();
    expect((await handler(req('DELETE'))).status).toBe(405);
    for (let i = 0; i < 60; i++) await handler(req('POST', { bet: draft }, '', '6.6.6.6'));
    expect((await handler(req('POST', { bet: draft }, '', '6.6.6.6'))).status).toBe(429);
    expect((await handler(req('POST', { bet: draft }, '', '7.7.7.7'))).status).toBe(201); // others unaffected
  });

  it('validates the bet and league membership', async () => {
    const { handler } = setup();
    expect((await handler(req('POST', { bet: { ...draft, sideB: 'ua' } }))).status).toBe(400);
    expect((await handler(req('POST', { bet: { ...draft, terms: '  ' } }))).status).toBe(400);
    expect((await handler(req('POST', { bet: { ...draft, sideB: 'stranger' } }))).status).toBe(400);
    expect((await handler(req('POST', { bet: { ...draft, season: '2019' } }))).status).toBe(400);
  });

  it('books any number of bets on the same matchup and week — each its own bet', async () => {
    const { handler } = setup();
    const one = await create(handler);
    const two = await create(handler); // identical wager, still a separate bet
    const three = await create(handler, { terms: 'Loser wears a Cowboys jersey to work.' });
    expect(new Set([one.id, two.id, three.id]).size).toBe(3);
    const list = (await (await handler(new Request(`${URL_}?season=2025`))).json()) as { bets: BetRecord[] };
    expect(list.bets).toHaveLength(3);
  });

  it('fails closed when Sleeper is down (membership is unverifiable)', async () => {
    const down = setup({ down: true });
    expect((await down.handler(req('POST', { bet: draft }))).status).toBe(503);
    expect(down.store.size()).toBe(0);
  });

  it('edits with the current version and rejects a stale one', async () => {
    const { handler } = setup();
    const bet = await create(handler);
    const res = await handler(patch(bet, { terms: 'two kegs' }));
    expect(res.status).toBe(200);
    const edited = await bodyBet(res);
    expect(edited).toMatchObject({ terms: 'two kegs', createdAt: bet.createdAt });
    expect(edited.version).not.toBe(bet.version);

    const stale = await handler(patch(bet, { terms: 'a High Noon' }));
    expect(stale.status).toBe(409);
    expect((await bodyBet(stale)).terms).toBe('two kegs');
  });

  it('edits any field at any time, and takes a ruling', async () => {
    const { handler } = setup();
    let bet = await create(handler);
    bet = await bodyBet(await handler(patch(bet, { week: 2, terms: 'a High Noon' }))); // no kickoff lock
    expect(bet).toMatchObject({ week: 2, terms: 'a High Noon' });
    const res = await handler(patch(bet, { winner: 'B' }));
    expect(res.status).toBe(200);
    const ruled = await bodyBet(res);
    expect(ruled).toMatchObject({ winner: 'B', terms: 'a High Noon' });
    expect((await handler(patch(ruled, { sideB: 'ua' }))).status).toBe(400); // still can't bet yourself
  });

  it('rewriting the wager clears a ruling made on the old terms', async () => {
    const { handler } = setup();
    let bet = await create(handler);
    bet = await bodyBet(await handler(patch(bet, { winner: 'A' })));
    const res = await handler(patch(bet, { sideA: 'uc', terms: 'two kegs' }));
    expect(await bodyBet(res)).toMatchObject({ sideA: 'uc', terms: 'two kegs', winner: null });
  });

  it('rejects a patch that rewrites the wager and rules on it at once', async () => {
    const { handler } = setup();
    const bet = await create(handler);
    expect((await handler(patch(bet, { terms: 'two kegs', winner: 'A' }))).status).toBe(400);
  });

  it('a bet whose manager left the league can still be repaired', async () => {
    const members = new Set(['ua', 'ub', 'uc']);
    const { handler } = setup({ members });
    const bet = await create(handler); // ua vs ub
    members.delete('ua'); // ua's roster changed owners mid-season
    const res = await handler(patch(bet, { terms: 'two kegs' }));
    expect(res.status).toBe(200); // untouched sides aren't re-checked
    const edited = await bodyBet(res);
    const swap = await handler(patch(edited, { sideA: 'uc' })); // swap in the new owner
    expect(swap.status).toBe(200);
    const swapped = await bodyBet(swap);
    expect(swapped).toMatchObject({ sideA: 'uc', rosterA: 3, rosterB: 2 }); // new side's roster, old side's kept
    expect((await handler(patch(swapped, { sideB: 'nobody' }))).status).toBe(400); // new sides still checked
  });

  it("won't pair a departed manager with their roster's new owner", async () => {
    const members = new Set(['ua', 'ub', 'uc']);
    const store = memoryBetStore();
    let rosterOf: Record<string, number> = { ua: 1, ub: 2, uc: 3 };
    const facts: FactsFor = async () => ({ members, rosterOf });
    const handler = makeBetsHandler({ store: () => store, facts });
    const bet = await create(handler); // ua (roster 1) vs ub
    members.delete('ua');
    members.add('ux');
    rosterOf = { ux: 1, ub: 2, uc: 3 }; // ux took over ua's roster
    expect((await handler(patch(bet, { sideB: 'ux' }))).status).toBe(400); // ua's roster 1 vs ux's roster 1
    expect((await handler(patch(bet, { sideA: 'ux' }))).status).toBe(200); // replacing the departed side is fine
  });

  it('delete is a tombstone, and restorable', async () => {
    const { handler, store } = setup();
    const bet = await create(handler);
    const gone = await bodyBet(await handler(patch(bet, { deleted: true })));
    expect(gone.deletedAt).toBe('2025-10-10T12:00:00.000Z');
    expect(store.size()).toBe(1);
    const back = await bodyBet(await handler(patch(gone, { deleted: false })));
    expect(back.deletedAt).toBeNull();
  });

  it('a deleted bet takes no edits until restored', async () => {
    const { handler } = setup();
    const bet = await create(handler);
    const gone = await bodyBet(await handler(patch(bet, { deleted: true })));
    for (const p of [{ terms: 'two kegs' }, { winner: 'A' }, { deleted: false, terms: 'two kegs' }]) {
      const res = await handler(patch(gone, p));
      expect(res.status).toBe(409);
      expect((await bodyBet(res)).deletedAt).toBeTruthy();
    }
    expect((await handler(patch(gone, { deleted: false }))).status).toBe(200);
  });

  it('404s an unknown bet and 400s a malformed address', async () => {
    const { handler } = setup();
    const bet = await create(handler);
    expect((await handler(req('PATCH', { patch: { deleted: true }, version: 'v1' }, '?season=2025&id=nope'))).status).toBe(404);
    expect((await handler(req('PATCH', { patch: { deleted: true }, version: 'v1' }, '?season=../&id=x'))).status).toBe(400);
    expect((await handler(req('PATCH', { patch: { deleted: true } }, `?season=2025&id=${bet.id}`))).status).toBe(400);
  });
});
