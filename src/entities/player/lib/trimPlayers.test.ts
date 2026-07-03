import { describe, expect, it } from 'vitest';
import type { RawPlayer } from '@/shared/api/types';
import { trimPlayers } from './trimPlayers';

describe('trimPlayers', () => {
  it('keeps active fantasy positions, DEF regardless of status, drops the rest', () => {
    const raw: Record<string, RawPlayer> = {
      qb1: { first_name: 'Pat', last_name: 'M', position: 'QB', team: 'KC', age: 30, years_exp: 8, status: 'Active' },
      cut: { first_name: 'Old', last_name: 'Guy', position: 'RB', status: 'Inactive' },
      ol1: { first_name: 'Big', last_name: 'Guard', position: 'OL', status: 'Active' },
      SF: { first_name: 'San Francisco', last_name: '49ers', position: 'DEF' },
    };
    const out = trimPlayers(raw);
    expect(Object.keys(out).sort()).toEqual(['SF', 'qb1']);
    expect(out['qb1']).toEqual({ n: 'Pat M', p: 'QB', t: 'KC', a: 30, x: 8 });
  });

  it('defaults team to FA and unknown years_exp to -1', () => {
    const out = trimPlayers({ k1: { first_name: 'Leg', last_name: 'Man', position: 'K', status: 'Active', years_exp: null } });
    expect(out['k1']).toMatchObject({ t: 'FA', x: -1 });
  });
});
