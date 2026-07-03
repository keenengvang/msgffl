import { describe, expect, it } from 'vitest';
import type { League } from '@/shared/api/types';
import { ptsKey } from './ptsKey';

const league = (rec?: number): League =>
  ({ league_id: 'x', previous_league_id: null, name: 'L', season: '2024', status: 'complete', scoring_settings: rec === undefined ? undefined : { rec } }) as League;

describe('ptsKey', () => {
  it('detects PPR / half / standard from rec scoring', () => {
    expect(ptsKey(league(1))).toBe('pts_ppr');
    expect(ptsKey(league(0.5))).toBe('pts_half_ppr');
    expect(ptsKey(league(0))).toBe('pts_std');
  });
  it('defaults to PPR when settings are missing', () => {
    expect(ptsKey(league())).toBe('pts_ppr');
    expect(ptsKey(undefined)).toBe('pts_ppr');
  });
});
