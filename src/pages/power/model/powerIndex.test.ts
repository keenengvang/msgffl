import { describe, expect, it } from 'vitest';
import type { StandingRow } from '@/entities/team/model/types';
import type { SeasonWeeks } from '@/shared/api/types';
import { powerIndex } from './powerIndex';

const row = (rosterId: number, w: number, pf: number): StandingRow => ({
  rosterId,
  ownerId: `o${rosterId}`,
  team: `T${rosterId}`,
  owner: `o${rosterId}`,
  avatar: '',
  w,
  l: 14 - w,
  t: 0,
  pf,
  pa: 1000,
  recordStr: '',
});

describe('powerIndex', () => {
  it('scores wins*3 + normalizedPF*4 + last5Wins*0.8 and sorts desc', () => {
    const stand = [row(1, 10, 1600), row(2, 5, 1200)];
    // no weeks data → l5w = 0 for everyone
    const out = powerIndex(stand, undefined, 15);
    // normPF: r1 = (1600-1200)/400 = 1 → 10*3 + 4 = 34 ; r2 = 0 → 15
    expect(out[0]!.r.rosterId).toBe(1);
    expect(out[0]!.idx).toBeCloseTo(34);
    expect(out[1]!.idx).toBeCloseTo(15);
  });

  it('last-5 counts only regular-season played games', () => {
    const stand = [row(1, 7, 1400), row(2, 7, 1400)];
    const weeks: SeasonWeeks = {};
    // 6 regular-season wins for roster 1 (only last 5 count) + playoff week ignored
    for (let w = 1; w <= 6; w++) weeks[w] = [{ m: 1, r: 1, p: 120 }, { m: 1, r: 2, p: 100 }];
    weeks[7] = [{ m: 1, r: 1, p: 0 }, { m: 1, r: 2, p: 0 }]; // unplayed — skipped
    weeks[16] = [{ m: 1, r: 1, p: 200 }, { m: 1, r: 2, p: 50 }]; // playoffs — excluded
    const out = powerIndex(stand, weeks, 15);
    const r1 = out.find((e) => e.r.rosterId === 1)!;
    expect(r1.l5).toHaveLength(5);
    expect(r1.l5w).toBe(5);
    const r2 = out.find((e) => e.r.rosterId === 2)!;
    expect(r2.l5w).toBe(0);
  });
});
