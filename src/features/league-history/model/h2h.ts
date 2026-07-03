import type { SeasonBundle } from './buildSeasonBundle';

export interface H2hRecord {
  w: number;
  l: number;
}

/** h2h[ownerA][ownerB] = A's record vs B. Regular season only (weeks < pws);
    ties and 0–0 unplayed pairs are skipped. */
export function h2h(bundles: SeasonBundle[]): Record<string, Record<string, H2hRecord>> {
  const out: Record<string, Record<string, H2hRecord>> = {};
  bundles.forEach((b) => {
    b.weeks.forEach((wl, wi) => {
      if (wi + 1 >= b.pws) return;
      const by: Record<number, typeof wl> = {};
      (wl ?? []).forEach((e) => {
        if (e.m == null) return;
        (by[e.m] ??= []).push(e);
      });
      Object.values(by).forEach((pair) => {
        if (pair.length !== 2) return;
        const [x, y] = pair as [(typeof pair)[0], (typeof pair)[0]];
        if ((x.p || 0) === 0 && (y.p || 0) === 0) return;
        const ka = b.names[x.r]?.ownerId;
        const kb = b.names[y.r]?.ownerId;
        if (!ka || !kb) return;
        out[ka] ??= {};
        out[kb] ??= {};
        out[ka][kb] ??= { w: 0, l: 0 };
        out[kb][ka] ??= { w: 0, l: 0 };
        if (x.p !== y.p) {
          const aw = x.p > y.p;
          out[ka][kb][aw ? 'w' : 'l']++;
          out[kb][ka][aw ? 'l' : 'w']++;
        }
      });
    });
  });
  return out;
}
