import { describe, it, expect } from 'vitest';
import { buildRosterRows } from './buildRosterRows';
import type { Matchup, PlayersDb } from '@/shared/api/types';

const DB: PlayersDb = {
  '1': { n: 'Starter QB', p: 'QB', t: 'KC', a: 28, x: 5 },
  '2': { n: 'Bench Low', p: 'RB', t: 'SF', a: 24, x: 2 },
  '3': { n: 'Bench High', p: 'WR', t: 'MIA', a: 26, x: 3 },
};

describe('buildRosterRows', () => {
  it('returns an empty list when the matchup or players db is missing', () => {
    expect(buildRosterRows(undefined, DB)).toEqual([]);
    expect(buildRosterRows({ matchup_id: 1, roster_id: 1 }, undefined)).toEqual([]);
  });

  it('puts starters first in their original order, then bench sorted by points', () => {
    const matchup: Matchup = {
      matchup_id: 1,
      roster_id: 1,
      starters: ['1'],
      players: ['1', '2', '3'],
      players_points: { '1': 24.5, '2': 3.1, '3': 11.2 },
    };
    expect(buildRosterRows(matchup, DB).map((r) => r.pid)).toEqual(['1', '3', '2']);
  });

  it('marks starters and fills unknown players with a placeholder', () => {
    const matchup: Matchup = {
      matchup_id: 1,
      roster_id: 1,
      starters: ['1'],
      players: ['1', '99'],
      players_points: { '1': 24.5 },
    };
    const rows = buildRosterRows(matchup, DB);
    expect(rows[0]).toMatchObject({ pid: '1', starter: true, pts: 24.5 });
    expect(rows[1]).toMatchObject({ pid: '99', starter: false, pts: null, name: 'Player #99' });
  });

  it('drops the "0" placeholder Sleeper uses for empty slots', () => {
    const matchup: Matchup = {
      matchup_id: 1,
      roster_id: 1,
      starters: ['1', '0'],
      players: ['1', '0'],
      players_points: { '1': 24.5 },
    };
    expect(buildRosterRows(matchup, DB).map((r) => r.pid)).toEqual(['1']);
  });
});
