import { describe, expect, it } from 'vitest';
import type { LeagueUser, Roster } from '@/shared/api/types';
import { computeStandings, usersById } from './computeStandings';

const users: LeagueUser[] = [
  { user_id: 'u1', display_name: 'alice', avatar: 'av1', metadata: { team_name: 'Team Alice' } },
  { user_id: 'u2', display_name: 'bob', avatar: null },
  { user_id: 'u3', display_name: 'carol', avatar: null },
];

const roster = (id: number, owner: string, wins: number, fpts: number, dec = 0): Roster => ({
  roster_id: id,
  owner_id: owner,
  settings: { wins, losses: 14 - wins, ties: 0, fpts, fpts_decimal: dec, fpts_against: 1000 },
});

describe('computeStandings', () => {
  it('sorts by wins desc, then PF desc', () => {
    const rows = computeStandings(
      [roster(1, 'u1', 8, 1500), roster(2, 'u2', 10, 1400), roster(3, 'u3', 8, 1600)],
      usersById(users),
    );
    expect(rows.map((r) => r.ownerId)).toEqual(['u2', 'u3', 'u1']);
  });

  it('combines fpts integer and decimal parts', () => {
    const rows = computeStandings([roster(1, 'u1', 1, 1500, 62)], usersById(users));
    expect(rows[0]!.pf).toBeCloseTo(1500.62);
  });

  it('prefers metadata.team_name, falls back to display_name, then roster id', () => {
    const rows = computeStandings(
      [roster(1, 'u1', 3, 100), roster(2, 'u2', 2, 100), roster(3, 'ghost', 1, 100)],
      usersById(users),
    );
    expect(rows[0]!.team).toBe('Team Alice');
    expect(rows[1]!.team).toBe('bob');
    expect(rows[2]!.team).toBe('Team 3');
    expect(rows[2]!.owner).toBe('—');
  });
});
