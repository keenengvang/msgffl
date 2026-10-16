import { describe, expect, it } from 'vitest';
import type { DraftPick, SeasonLineups } from '@/shared/api/types';
import type { Move } from '@/entities/transaction/lib/moves';
import { draftValue, pickupValue } from './acquisitions';

const pick = (n: number, roster: number, id: string): DraftPick =>
  ({ pick_no: n, round: 1, roster_id: roster, player_id: id, picked_by: '', draft_slot: n, metadata: { first_name: id, last_name: 'X' } }) as DraftPick;

describe('draftValue', () => {
  it('scores what each pick gave its drafter against the picks around it', () => {
    const picks = [pick(1, 1, 'a'), pick(2, 2, 'b'), pick(3, 1, 'c')];
    const lineups: SeasonLineups = {
      1: [
        { r: 1, s: ['a'], pp: { a: 60, c: 30 } }, // c benched: worth nothing
        { r: 2, s: ['b'], pp: { b: 120 } },
      ],
      2: [
        { r: 1, s: ['a'], pp: { a: 40 } },
        { r: 2, s: ['b'], pp: { b: 80 } },
      ],
    };
    const { picks: values, classes } = draftValue(picks, lineups, 2);
    // With 3 picks the ±7 window is everyone: expectation = 100.
    expect(values.map((v) => v.value)).toEqual([0, 100, -100]);
    expect(classes[0]).toMatchObject({ rosterId: 2, value: 100 });
    expect(classes[1]!.best.playerId).toBe('a');
    expect(classes[1]!.worst.playerId).toBe('c');
  });

  it("a pick cut early earns its drafter nothing, whatever he does elsewhere", () => {
    const lineups: SeasonLineups = { 1: [{ r: 2, s: ['a'], pp: { a: 50 } }] }; // starring for team 2
    const { picks } = draftValue([pick(1, 1, 'a')], lineups, 1);
    expect(picks[0]!.pts).toBe(0);
  });
});

const move = (over: Partial<Move>): Move => ({
  id: 'm', season: '2026', week: 1, type: 'waiver', failed: false, rosterIds: [1], adds: {}, drops: {}, bid: 0, faab: [], picks: [], at: 0, ...over,
});

describe('pickupValue', () => {
  it('counts only starting-lineup points from the add week on, and only real claims', () => {
    const lineups: SeasonLineups = {
      1: [{ r: 1, s: ['p'], pp: { p: 50 } }], // before the add: not his
      2: [{ r: 1, s: ['p'], pp: { p: 20 } }],
      3: [{ r: 1, s: [], pp: { p: 30 } }], // benched: worth nothing
      4: [{ r: 1, s: ['p'], pp: { p: 10 } }],
    };
    const moves = [
      move({ week: 2, adds: { p: 1 }, bid: 12 }),
      move({ week: 2, adds: { q: 1 }, bid: 40, failed: true }), // lost the claim
      move({ week: 3, type: 'trade', adds: { z: 1 } }),
      move({ week: 3, type: 'free_agent', adds: { f: 1 }, bid: null }),
    ];
    const { rows, pickups } = pickupValue(moves, lineups, 4);
    expect(pickups.find((p) => p.playerId === 'p')).toMatchObject({ started: 30, bid: 12 });
    expect(rows[0]).toMatchObject({ rosterId: 1, faab: 12, adds: 2, started: 30 });
    expect(rows[0]!.perDollar).toBe(2.5);
  });

  it('ignores claims after the cutoff week — no bid charged for points it can’t count yet', () => {
    const moves = [move({ week: 5, adds: { p: 1 }, bid: 30 }), move({ week: 15, adds: { q: 1 }, bid: 20 })];
    const { rows, pickups } = pickupValue(moves, {}, 14);
    expect(pickups.map((p) => p.playerId)).toEqual(['p']);
    expect(rows[0]).toMatchObject({ faab: 30, adds: 1 });
  });

  it("re-adding the same player doesn't double his points", () => {
    const lineups: SeasonLineups = { 2: [{ r: 1, s: ['p'], pp: { p: 20 } }] };
    const moves = [move({ week: 2, adds: { p: 1 }, bid: 5 }), move({ week: 1, adds: { p: 1 }, bid: 3 })];
    const { pickups } = pickupValue(moves, lineups, 2);
    expect(pickups).toHaveLength(1);
    expect(pickups[0]).toMatchObject({ week: 1, bid: 8, started: 20 });
  });
});
