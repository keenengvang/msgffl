import { describe, expect, it } from 'vitest';
import { GRADE_BANTER, pickBanter, type BanterPool } from './banter';

describe('banter pools', () => {
  it('every pool ships both tones with no empty lines (house rule)', () => {
    const pools: BanterPool[] = Object.values(GRADE_BANTER);
    pools.forEach((pool) => {
      expect(pool.savage.length).toBeGreaterThan(0);
      expect(pool.polite.length).toBeGreaterThan(0);
      [...pool.savage, ...pool.polite].forEach((line) => expect(line.trim()).not.toBe(''));
    });
  });
});

// The biggest pool, so the no-repeat test has room to work.
const POOL = Object.values(GRADE_BANTER).sort((a, b) => b.savage.length - a.savage.length)[0]!;

describe('pickBanter', () => {
  it('is deterministic for the same seed and varies across seeds', () => {
    const a = pickBanter(POOL, 'savage', '2024-1');
    expect(pickBanter(POOL, 'savage', '2024-1')).toBe(a);
    const all = Array.from({ length: 20 }, (_, i) => pickBanter(POOL, 'savage', `2024-${i}`));
    expect(new Set(all).size).toBeGreaterThan(1);
  });

  it('respects the tone', () => {
    expect(POOL.polite).toContain(pickBanter(POOL, 'polite', 'x'));
    expect(POOL.savage).toContain(pickBanter(POOL, 'savage', 'x'));
  });

  it('never repeats a line on one page when given a used set', () => {
    const used = new Set<string>();
    const n = POOL.savage.length;
    const picked = Array.from({ length: n }, (_, i) => pickBanter(POOL, 'savage', `seed-${i}`, used));
    expect(new Set(picked).size).toBe(n);
  });
});
