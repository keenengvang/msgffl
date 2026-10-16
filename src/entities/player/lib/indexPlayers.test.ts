import { describe, expect, it } from 'vitest';
import { indexPlayers } from './indexPlayers';

describe('indexPlayers', () => {
  it('keeps inactive players and resolves fantasy eligibility over the NFL position', () => {
    const idx = indexPlayers({
      a: { first_name: 'Cut', last_name: 'Guy', position: 'RB', status: 'Inactive' },
      b: { first_name: 'Two', last_name: 'Way', position: 'DB', fantasy_positions: ['WR', 'DB'], status: 'Active' },
      c: { first_name: 'Line', last_name: 'Backer', position: 'LB', fantasy_positions: ['LB'] },
      d: { position: 'DEF', last_name: 'Bills' },
    });
    expect(idx).toEqual({ a: { n: 'Cut Guy', p: 'RB' }, b: { n: 'Two Way', p: 'WR' }, d: { n: 'Bills', p: 'DEF' } });
  });
});
