import type { SeasonBundle } from './buildSeasonBundle';

export interface RecordEntry {
  val: number;
  who: string;
  sub: string;
}

export interface RecordBook {
  hiWk: RecordEntry | null;
  loWk: RecordEntry | null;
  blow: RecordEntry | null;
  close: RecordEntry | null;
  hiPF: RecordEntry | null;
  hiPA: RecordEntry | null;
}

/** Scan every season's weekly scores for the league records.
    0–0 pairs are unplayed and skipped; lowest week requires points > 0. */
export function recordBook(bundles: SeasonBundle[]): RecordBook {
  let hiWk: RecordEntry | null = null;
  let loWk: RecordEntry | null = null;
  let blow: RecordEntry | null = null;
  let close: RecordEntry | null = null;
  let hiPF: RecordEntry | null = null;
  let hiPA: RecordEntry | null = null;

  bundles.forEach((b) => {
    b.standings.forEach((r) => {
      if (!hiPF || r.pf > hiPF.val)
        hiPF = { val: r.pf, who: `${r.team} (${r.owner})`, sub: `${b.season} SEASON · ${r.w}–${r.l}` };
      if (!hiPA || r.pa > hiPA.val)
        hiPA = { val: r.pa, who: `${r.team} (${r.owner})`, sub: `${b.season} SEASON · TURNSTILE DEFENSE` };
    });
    b.weeks.forEach((wl, wi) => {
      const by: Record<number, typeof wl> = {};
      (wl ?? []).forEach((e) => {
        if (e.m == null) return;
        (by[e.m] ??= []).push(e);
      });
      Object.values(by).forEach((pair) => {
        if (pair.length !== 2) return;
        const [x, y] = pair as [(typeof pair)[0], (typeof pair)[0]];
        if ((x.p || 0) === 0 && (y.p || 0) === 0) return;
        const nx = b.names[x.r];
        const ny = b.names[y.r];
        const wk = `WK ${wi + 1} · ${b.season}`;
        (
          [
            [x, nx, ny],
            [y, ny, nx],
          ] as const
        ).forEach(([e, n, opp]) => {
          if (!hiWk || e.p > hiWk.val)
            hiWk = { val: e.p, who: `${n?.team} (${n?.owner})`, sub: `${wk} · vs ${opp?.team ?? '?'}` };
          if ((e.p || 0) > 0 && (!loWk || e.p < loWk.val))
            loWk = { val: e.p, who: `${n?.team} (${n?.owner})`, sub: `${wk} · a crime scene` };
        });
        const margin = Math.abs(x.p - y.p);
        const winN = x.p > y.p ? nx : ny;
        const loseN = x.p > y.p ? ny : nx;
        if (!blow || margin > blow.val)
          blow = { val: margin, who: `${winN?.team ?? '?'} over ${loseN?.team ?? '?'}`, sub: wk };
        if (margin > 0 && (!close || margin < close.val))
          close = { val: margin, who: `${winN?.team ?? '?'} edged ${loseN?.team ?? '?'}`, sub: wk };
      });
    });
  });

  return { hiWk, loWk, blow, close, hiPF, hiPA };
}
