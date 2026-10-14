/**
 * The betting board API. Storage and Sleeper are injected so the handler is
 * testable with an in-memory store and canned facts; netlify/functions/bets.ts
 * wires the real ones.
 *
 *   GET    ?season=2025            → { bets }   (no season: every bet — the export)
 *   POST   { bet, by }             → 201 { bet }
 *   PATCH  ?season=&id=  { patch, version, by } → { bet }
 *          patch.deleted true/false tombstones / restores — there is no hard delete.
 *
 * Writes need the league PIN in `x-bets-pin` (BETS_PIN env var). Reads are
 * public. Once either side has points on the board the wager is locked: only
 * the ruling, `paidTo` and the tombstone can change after that.
 */
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { touchesTerms, validateDraft, validatePatch, validateWho } from '@/entities/bet/lib/validate';
import type { Bet, BetRecord } from '@/entities/bet/model/types';
import type { BetStore, Versioned } from './betStore';
import type { FactsFor, WeekFacts } from './betFacts';

export interface BetsDeps {
  store: () => BetStore;
  facts: FactsFor;
  now?: () => Date;
}

// Best-effort brute-force brake on the PIN (per warm instance), same shape as
// the suggestion box's limiter. Only wrong guesses count.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_BAD_PINS = 10;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

const record = ({ bet, version }: Versioned): BetRecord => ({ ...bet, version });
const SEASON = /^\d{4}$/;
const ID = /^[\w-]{1,64}$/;

function samePin(given: string, want: string): boolean {
  const h = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(h(given), h(want));
}

export function makeBetsHandler(deps: BetsDeps) {
  const now = deps.now ?? (() => new Date());
  const badPins = new Map<string, number[]>();

  /** null = allowed; otherwise the response to send. */
  function gate(req: Request): Response | null {
    const pin = process.env.BETS_PIN;
    if (!pin) return json(500, { error: 'betting board not configured (missing BETS_PIN)' });
    const ip = req.headers.get('x-nf-client-connection-ip') ?? 'unknown';
    const t = Date.now();
    const recent = (badPins.get(ip) ?? []).filter((x) => t - x < WINDOW_MS);
    if (recent.length >= MAX_BAD_PINS) return json(429, { error: 'too many wrong PINs. try again in an hour.' });
    if (samePin(req.headers.get('x-bets-pin') ?? '', pin)) return null;
    recent.push(t);
    badPins.set(ip, recent);
    return json(401, { error: 'wrong league PIN' });
  }

  /** Sleeper facts for a season/week, or the error response. */
  async function factsOr(season: string, week: number): Promise<WeekFacts | Response> {
    try {
      const f = await deps.facts(season, week);
      return f ?? json(400, { error: `no ${season} season in this league` });
    } catch {
      return json(503, { error: "couldn't reach Sleeper to check kickoff — try again in a minute" });
    }
  }

  /** The wager can't be (re)written once it's live, and both sides must be in
      the league that season. */
  async function checkWager(bet: Pick<Bet, 'season' | 'week' | 'sideA' | 'sideB'>): Promise<Response | null> {
    const f = await factsOr(bet.season, bet.week);
    if (f instanceof Response) return f;
    if (!f.members.has(bet.sideA) || !f.members.has(bet.sideB)) {
      return json(400, { error: `both sides must be in the ${bet.season} league` });
    }
    if (f.locked(bet)) return json(423, { error: 'that one already kicked off — the wager is locked' });
    return null;
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

    const denied = gate(req);
    if (denied) return denied;

    const payload = await body(req);
    if (!payload) return json(400, { error: 'invalid JSON' });
    const who = validateWho(payload.by);
    if (!who.ok) return json(400, { error: who.error });
    const stamp = now().toISOString();

    if (req.method === 'POST') {
      const draft = validateDraft(payload.bet);
      if (!draft.ok) return json(400, { error: draft.error });
      const blocked = await checkWager(draft.value);
      if (blocked) return blocked;
      const bet: Bet = {
        ...draft.value,
        id: randomUUID(),
        winner: null,
        paidTo: null,
        createdBy: who.value,
        createdAt: stamp,
        updatedBy: who.value,
        updatedAt: stamp,
        deletedAt: null,
        deletedBy: null,
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

    // Rewriting the wager and settling it are separate acts: a combined patch
    // could carry an old ruling or payment onto new terms.
    if (touchesTerms(patch.value) && ('winner' in patch.value || 'paidTo' in patch.value)) {
      return json(400, { error: 'settle up separately from rewriting the wager' });
    }

    const { deleted, ...fields } = patch.value;
    const next: Bet = { ...current.bet, ...fields, updatedBy: who.value, updatedAt: stamp };
    // A rewritten wager is a new wager: a ruling or payment on the old terms
    // (custom bets can be ruled before kickoff) must not carry over to it.
    if (touchesTerms(patch.value)) Object.assign(next, { winner: null, paidTo: null });
    if (deleted === true && !current.bet.deletedAt) Object.assign(next, { deletedAt: stamp, deletedBy: who.value });
    if (deleted === false) Object.assign(next, { deletedAt: null, deletedBy: null });

    if (next.sideA === next.sideB) return json(400, { error: "you can't bet against yourself" });
    if (next.terms.kind === 'matchup' && next.winner !== null) {
      // Keep it null rather than reject when a custom bet is switched to matchup.
      if (fields.winner) return json(400, { error: 'matchup bets are settled by the scoreboard' });
      next.winner = null;
    }
    if (touchesTerms(patch.value)) {
      // Locked as it stands, or locked where it's being moved to.
      const moved = (['season', 'week', 'sideA', 'sideB'] as const).some((k) => next[k] !== current.bet[k]);
      const blocked = (await checkWager(current.bet)) ?? (moved ? await checkWager(next) : null);
      if (blocked) return blocked;
    }

    const saved = await store.replace(next, current.version);
    if (!saved) {
      const fresh = await store.get(season, id);
      return json(409, { error: 'someone else edited this bet first', bet: fresh ? record(fresh) : null });
    }
    return json(200, { bet: record(saved) });
  };
}
