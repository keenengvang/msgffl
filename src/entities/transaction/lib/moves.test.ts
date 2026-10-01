import { describe, expect, it } from 'vitest';
import type { Transaction } from '@/shared/api/types';
import { byBid, faabSpend, trimMoves } from './moves';

const tx = (over: Partial<Transaction>): Transaction => ({
  transaction_id: 't',
  type: 'waiver',
  status: 'complete',
  leg: 3,
  created: 100,
  roster_ids: [1],
  adds: { p1: 1 },
  drops: null,
  settings: { waiver_bid: 10 },
  waiver_budget: [],
  draft_picks: [],
  ...over,
});

describe('trimMoves', () => {
  it('keeps the bid on waivers, nulls it elsewhere, and drops commissioner edits', () => {
    const out = trimMoves(
      [
        tx({ transaction_id: 'w' }),
        tx({ transaction_id: 'fa', type: 'free_agent', settings: null }),
        tx({ transaction_id: 'c', type: 'commissioner' }),
      ],
      '2025',
    );
    expect(out.map((m) => [m.id, m.bid])).toEqual([
      ['w', 10],
      ['fa', null],
    ]);
    expect(out[0]).toMatchObject({ season: '2025', week: 3, failed: false, adds: { p1: 1 }, drops: {} });
  });

  it('marks failed claims and keeps the reason; a $0 claim is a bid of 0, not null', () => {
    const [m] = trimMoves(
      [tx({ status: 'failed', settings: {}, metadata: { notes: 'This player was claimed by another owner.' } })],
      '2025',
    );
    expect(m).toMatchObject({ failed: true, bid: 0, note: 'This player was claimed by another owner.' });
  });

  it('carries traded FAAB and picks', () => {
    const [m] = trimMoves(
      [
        tx({
          type: 'trade',
          roster_ids: [1, 2],
          waiver_budget: [{ sender: 1, receiver: 2, amount: 15 }],
          draft_picks: [{ season: '2026', round: 2, roster_id: 1, previous_owner_id: 1, owner_id: 2 }],
        }),
      ],
      '2025',
    );
    expect(m!.faab).toEqual([{ from: 1, to: 2, amount: 15 }]);
    expect(m!.picks).toEqual([{ season: '2026', round: 2, originalRosterId: 1, from: 1, to: 2 }]);
  });
});

describe('faabSpend', () => {
  it('counts winning waiver bids only — losing bids and traded FAAB cost nothing', () => {
    const moves = trimMoves(
      [
        tx({ transaction_id: 'a', settings: { waiver_bid: 30 } }),
        tx({ transaction_id: 'b', settings: { waiver_bid: 12 } }),
        tx({ transaction_id: 'lost', status: 'failed', settings: { waiver_bid: 90 } }),
        tx({ transaction_id: 'r2', roster_ids: [2], settings: { waiver_bid: 0 } }),
        tx({ transaction_id: 'trade', type: 'trade', waiver_budget: [{ sender: 1, receiver: 2, amount: 50 }] }),
      ],
      '2025',
    );
    expect(faabSpend(moves, (m) => String(m.rosterIds[0]))).toEqual({
      '1': { spent: 42, claims: 2, biggest: 30 },
      '2': { spent: 0, claims: 1, biggest: 0 },
    });
  });
});

describe('byBid', () => {
  it('sorts biggest bid first, newest first on a tie', () => {
    const moves = trimMoves(
      [
        tx({ transaction_id: 'old', settings: { waiver_bid: 20 }, created: 1 }),
        tx({ transaction_id: 'big', settings: { waiver_bid: 55 }, created: 2 }),
        tx({ transaction_id: 'new', settings: { waiver_bid: 20 }, created: 3 }),
      ],
      '2025',
    );
    expect([...moves].sort(byBid).map((m) => m.id)).toEqual(['big', 'new', 'old']);
  });
});
