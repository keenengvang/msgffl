import type { SeasonWeeks } from '@/shared/api/types';
import type { StandingRow } from '@/entities/team/model/types';

export interface PowerRow {
  r: StandingRow;
  idx: number;
  /** Last-5 regular-season results, 1 = win. */
  l5: number[];
  l5w: number;
}

/** Power index = wins*3 + normalizedPF*4 + last5Wins*0.8, sorted desc.
    Last-5 counts regular-season games only (weeks < pws), skipping 0–0 pairs. */
export function powerIndex(stand: StandingRow[], weeks: SeasonWeeks | undefined, pws: number): PowerRow[] {
  const maxPf = Math.max(1, ...stand.map((r) => r.pf));
  const minPf = Math.min(...stand.map((r) => r.pf));
  const rngPf = Math.max(1, maxPf - minPf);

  const last5: Record<number, number[]> = {};
  if (weeks) {
    for (let w = 1; w <= 17; w++) {
      if (w >= pws) continue;
      const by: Record<number, Array<{ m: number | null; r: number; p: number }>> = {};
      (weeks[w] ?? []).forEach((e) => {
        if (e.m != null) (by[e.m] ??= []).push(e);
      });
      Object.values(by).forEach((pair) => {
        if (pair.length !== 2) return;
        const x = pair[0]!;
        const y = pair[1]!;
        if ((x.p || 0) === 0 && (y.p || 0) === 0) return;
        (last5[x.r] ??= []).push(x.p > y.p ? 1 : 0);
        (last5[y.r] ??= []).push(y.p > x.p ? 1 : 0);
      });
    }
  }

  return stand
    .map((r) => {
      const l5 = (last5[r.rosterId] ?? []).slice(-5);
      const l5w = l5.reduce((a, b) => a + b, 0);
      return { r, idx: r.w * 3 + ((r.pf - minPf) / rngPf) * 4 + l5w * 0.8, l5, l5w };
    })
    .sort((a, b) => b.idx - a.idx);
}
