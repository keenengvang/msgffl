import { describe, expect, it } from 'vitest';
import { GRADE_BANTER, POWER_BANTER, pickBanter, type BanterPool } from './banter';

describe('banter pools', () => {
  it('every pool ships both tones with no empty lines (house rule)', () => {
    const pools: BanterPool[] = [...Object.values(POWER_BANTER), ...Object.values(GRADE_BANTER)];
    pools.forEach((pool) => {
      expect(pool.savage.length).toBeGreaterThan(0);
      expect(pool.polite.length).toBeGreaterThan(0);
      [...pool.savage, ...pool.polite].forEach((line) => expect(line.trim()).not.toBe(''));
    });
  });
});

describe('pickBanter', () => {
  it('is deterministic for the same seed and varies across seeds', () => {
    const a = pickBanter(POWER_BANTER.generic, 'savage', '2024-1');
    expect(pickBanter(POWER_BANTER.generic, 'savage', '2024-1')).toBe(a);
    const all = Array.from({ length: 20 }, (_, i) => pickBanter(POWER_BANTER.generic, 'savage', `2024-${i}`));
    expect(new Set(all).size).toBeGreaterThan(1);
  });

  it('respects the tone', () => {
    expect(POWER_BANTER.champ.polite).toContain(pickBanter(POWER_BANTER.champ, 'polite', 'x'));
    expect(POWER_BANTER.champ.savage).toContain(pickBanter(POWER_BANTER.champ, 'savage', 'x'));
  });

  it('never repeats a line on one page when given a used set', () => {
    const used = new Set<string>();
    const n = POWER_BANTER.generic.savage.length;
    const picked = Array.from({ length: n }, (_, i) => pickBanter(POWER_BANTER.generic, 'savage', `seed-${i}`, used));
    expect(new Set(picked).size).toBe(n);
  });
});
