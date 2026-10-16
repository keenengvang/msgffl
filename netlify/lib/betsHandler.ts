/**
 * The betting board API. Storage and Sleeper are injected so the handler is
 * testable with an in-memory store and canned facts; netlify/functions/bets.ts
 * wires the real ones.
 *
 *   GET    ?season=2025                  → { bets }   (no season: every bet — the export)
 *   POST   { bet }                       → 201 { bet }
 *   PATCH  ?season=&id=  { patch, version } → { bet }
 *          patch.deleted true/false tombstones / restores — there is no hard delete.
 *
 * No PIN: anyone with the link can book, rule on or delete a bet (the league
 * runs on trust and a single bookie). Writes are rate-limited per IP, and
 * deletes are restorable tombstones, so vandalism is annoying, not lossy.
 * There's no kickoff lock: bets get made out loud and typed in later, and the
 * same two teams can carry several bets in one week, so any bet can be booked
 * or edited at any time.
 */
import { randomUUID } from 'node:crypto';
import { touchesTerms, validateDraft, validatePatch } from '@/entities/bet/lib/validate';
import type { Bet, BetRecord } from '@/entities/bet/model/types';
import type { BetStore, Versioned } from './betStore';
import type { FactsFor, SeasonFacts } from './betFacts';

export interface BetsDeps {
  store: () => BetStore;
  facts: FactsFor;
  now?: () => Date;
}

// Best-effort spam brake (per warm function instance), same shape as the
// suggestion box's limiter. A busy league night is a few dozen writes.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_WRITES = 60;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

// Bets stored before payouts existed have no paidAt: unpaid.
const record = ({ bet, version }: Versioned): BetRecord => ({ ...bet, paidAt: bet.paidAt ?? null, version });
const SEASON = /^\d{4}$/;
const ID = /^[\w-]{1,64}$/;

export function makeBetsHandler(deps: BetsDeps) {
  const now = deps.now ?? (() => new Date());
  const writes = new Map<string, number[]>();

  /** true when this IP has written too much in the last hour. */
  function rateLimited(req: Request): boolean {
    const ip = req.headers.get('x-nf-client-connection-ip') ?? 'unknown';
    const t = Date.now();
    const recent = (writes.get(ip) ?? []).filter((x) => t - x < WINDOW_MS);
    recent.push(t);
    writes.set(ip, recent);
    return recent.length > MAX_WRITES;
  }

  /** Sleeper facts for a season, or the error response. */
  async function factsOr(season: string): Promise<SeasonFacts | Response> {
    try {
      const f = await deps.facts(season);
      return f ?? json(400, { error: `no ${season} season in this league` });
    } catch {
      return json(503, { error: "couldn't reach Sleeper to check the league — try again in a minute" });
    }
  }

  /** The sides named in `mustBeMembers` must be in the league that season.
      Only sides being set need checking: a bet whose manager has since left
      (a roster changed owners) must stay editable, or it could never be repaired. */
  async function checkSides(season: string, mustBeMembers: string[]): Promise<Response | SeasonFacts> {
    const f = await factsOr(season);
    if (f instanceof Response) return f;
    if (mustBeMembers.some((s) => !f.members.has(s))) {
      return json(400, { error: `both sides must be in the ${season} league` });
    }
    return f;
  }

  async function body(req: Request): Promise<Record<string, unknown> | null> {
    try {
      const b = await req.json();
      return typeof b === 'object' && b !== null ? b : null;
    } catch {
      return null;
    }
  }

  return async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'GET') {
      const season = url.searchParams.get('season') ?? undefined;
      if (season && !SEASON.test(season)) return json(400, { error: 'season must be a year' });
      const all = (await deps.store().list(season)).map(record);
      all.sort((a, b) => b.week - a.week || b.createdAt.localeCompare(a.createdAt));
      return json(200, { bets: all });
    }

    if (req.method !== 'POST' && req.method !== 'PATCH') return json(405, { error: 'GET, POST or PATCH' });

    if (rateLimited(req)) return json(429, { error: 'easy, bookie. too many changes — try again in an hour.' });

    const payload = await body(req);
    if (!payload) return json(400, { error: 'invalid JSON' });
    const stamp = now().toISOString();

    if (req.method === 'POST') {
      const draft = validateDraft(payload.bet);
      if (!draft.ok) return json(400, { error: draft.error });
      const facts = await checkSides(draft.value.season, [draft.value.sideA, draft.value.sideB]);
      if (facts instanceof Response) return facts;
      const bet: Bet = {
        ...draft.value,
        rosterA: facts.rosterOf[draft.value.sideA] ?? null,
        rosterB: facts.rosterOf[draft.value.sideB] ?? null,
        id: randomUUID(),
        winner: null,
        paidAt: null,
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
      };
      return json(201, { bet: record(await deps.store().create(bet)) });
    }

    // PATCH
    const season = url.searchParams.get('season') ?? '';
    const id = url.searchParams.get('id') ?? '';
    if (!SEASON.test(season) || !ID.test(id)) return json(400, { error: 'season and id are required' });
    const patch = validatePatch(payload.patch);
    if (!patch.ok) return json(400, { error: patch.error });
    if (typeof payload.version !== 'string') return json(400, { error: 'version is required' });

    const store = deps.store();
    const current = await store.get(season, id);
    if (!current) return json(404, { error: 'no such bet' });
    if (current.version !== payload.version) {
      return json(409, { error: 'someone else edited this bet first', bet: record(current) });
    }

    // A deleted bet is frozen until restored: the only patch it takes is
    // { deleted: false }. Otherwise an editor left open across a delete could
    // rewrite a wager that's sitting in the deleted pile.
    const p = patch.value;
    if (current.bet.deletedAt && !(Object.keys(p).length === 1 && p.deleted === false)) {
      return json(409, { error: 'that bet was deleted — restore it first', bet: record(current) });
    }

    // Rewriting the wager and settling it are separate acts: a combined patch
    // could carry an old ruling or payout onto new terms.
    if (touchesTerms(patch.value) && ('winner' in patch.value || 'paid' in patch.value)) {
      return json(400, { error: 'rule on a bet separately from rewriting it' });
    }

    const { deleted, paid, ...fields } = patch.value;
    const next: Bet = { ...current.bet, paidAt: current.bet.paidAt ?? null, ...fields, updatedAt: stamp };
    // A rewritten wager is a new wager: a ruling (and payout) on the old terms
    // must not carry over to it. A changed or overturned ruling voids the
    // payout too — whoever paid, paid on the old call.
    if (touchesTerms(patch.value)) next.winner = null;
    if (next.winner !== current.bet.winner) next.paidAt = null;
    if (paid === true) {
      if (!next.winner) return json(400, { error: 'mark a winner before marking it paid' });
      next.paidAt ??= stamp;
    }
    if (paid === false) next.paidAt = null;
    if (deleted === true && !current.bet.deletedAt) next.deletedAt = stamp;
    if (deleted === false) next.deletedAt = null;

    if (next.sideA === next.sideB) return json(400, { error: "a team can't bet against itself" });
    const changed = (['sideA', 'sideB'] as const).filter((k) => next[k] !== current.bet[k]);
    if (changed.length > 0) {
      // A side that changed gets its roster for that season; an unchanged
      // side keeps the roster recorded when it was set.
      for (const k of changed) next[k === 'sideA' ? 'rosterA' : 'rosterB'] = null;
      const facts = await checkSides(next.season, changed.map((k) => next[k]));
      if (facts instanceof Response) return facts;
      next.rosterA ??= facts.rosterOf[next.sideA] ?? null;
      next.rosterB ??= facts.rosterOf[next.sideB] ?? null;
      // Different owners can still be the same team: a departed manager kept
      // on one side and that roster's new owner picked for the other.
      if (next.rosterA !== null && next.rosterA === next.rosterB) {
        return json(400, { error: "both sides are the same team — swap out the manager who left" });
      }
    }

    const saved = await store.replace(next, current.version);
    if (!saved) {
      const fresh = await store.get(season, id);
      return json(409, { error: 'someone else edited this bet first', bet: fresh ? record(fresh) : null });
    }
    return json(200, { bet: record(saved) });
  };
}
