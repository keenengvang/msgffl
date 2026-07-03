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
  /** Highest combined score in a single game. */
  shootout: RecordEntry | null;
  /** Most points scored in a loss. */
  bestLoss: RecordEntry | null;
  /** Fewest points scored in a win. */
  worstWin: RecordEntry | null;
  /** Longest win streak — regular season only, within a season. */
  streakW: RecordEntry | null;
  /** Longest losing streak — regular season only, within a season. */
  streakL: RecordEntry | null;
  /** Most wins in a season (complete seasons only; ties broken by PF). */
  bestRec: RecordEntry | null;
  hiPF: RecordEntry | null;
  /** Fewest PF in a season — complete seasons only, or a partial year would "win". */
  loPF: RecordEntry | null;
  hiPA: RecordEntry | null;
}

/** Scan every season's weekly scores for the league records.
    0–0 pairs are unplayed and skipped; lowest week requires points > 0.
    Game records scan all played weeks incl. playoffs; streaks count regular
    season only (weeks < pws) — bracket byes would otherwise punch holes. */
export function recordBook(bundles: SeasonBundle[]): RecordBook {
  let hiWk: RecordEntry | null = null;
  let loWk: RecordEntry | null = null;
  let blow: RecordEntry | null = null;
  let close: RecordEntry | null = null;
  let shootout: RecordEntry | null = null;
  let bestLoss: RecordEntry | null = null;
  let worstWin: RecordEntry | null = null;
  let streakW: RecordEntry | null = null;
  let streakL: RecordEntry | null = null;
  let bestRec: RecordEntry | null = null;
  let bestRecPf = 0; // tie-break for bestRec: most wins, then most PF
  let hiPF: RecordEntry | null = null;
  let loPF: RecordEntry | null = null;
  let hiPA: RecordEntry | null = null;

  bundles.forEach((b) => {
    const complete = b.status === 'complete';
    b.standings.forEach((r) => {
      if (!hiPF || r.pf > hiPF.val)
        hiPF = { val: r.pf, who: `${r.team} (${r.owner})`, sub: `${b.season} SEASON · ${r.w}–${r.l}` };
      if (!hiPA || r.pa > hiPA.val)
        hiPA = { val: r.pa, who: `${r.team} (${r.owner})`, sub: `${b.season} SEASON · TURNSTILE DEFENSE` };
      if (complete && (!loPF || r.pf < loPF.val))
        loPF = { val: r.pf, who: `${r.team} (${r.owner})`, sub: `${b.season} SEASON · ${r.w}–${r.l}` };
      if (complete && (!bestRec || r.w > bestRec.val || (r.w === bestRec.val && r.pf > bestRecPf))) {
        bestRec = { val: r.w, who: `${r.team} (${r.owner})`, sub: `${b.season} SEASON · ${r.w}–${r.l}` };
        bestRecPf = r.pf;
      }
    });
    // Streak state per roster, reset each season: current run + the week it started.
    const st: Record<number, { w: number; ws: number; l: number; ls: number }> = {};
    b.weeks.forEach((wl, wi) => {
      const wkNum = wi + 1;
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
        const wk = `WK ${wkNum} · ${b.season}`;
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
        const hi = Math.max(x.p, y.p);
        const lo = Math.min(x.p, y.p);
        if (!shootout || x.p + y.p > shootout.val)
          shootout = {
            val: x.p + y.p,
            who: `${winN?.team ?? '?'} vs ${loseN?.team ?? '?'}`,
            sub: `${wk} · ${hi.toFixed(2)}–${lo.toFixed(2)}`,
          };
        if (margin > 0) {
          if (!bestLoss || lo > bestLoss.val)
            bestLoss = {
              val: lo,
              who: `${loseN?.team} (${loseN?.owner})`,
              sub: `${wk} · LOST TO ${winN?.team ?? '?'}`,
            };
          if (!worstWin || hi < worstWin.val)
            worstWin = {
              val: hi,
              who: `${winN?.team} (${winN?.owner})`,
              sub: `${wk} · BEAT ${loseN?.team ?? '?'}`,
            };
        }
        if (wkNum < b.pws) {
          if (margin === 0) {
            st[x.r] = { w: 0, ws: wkNum, l: 0, ls: wkNum };
            st[y.r] = { w: 0, ws: wkNum, l: 0, ls: wkNum };
            return;
          }
          const wr = x.p > y.p ? x.r : y.r;
          const lr = x.p > y.p ? y.r : x.r;
          const sw = (st[wr] ??= { w: 0, ws: wkNum, l: 0, ls: wkNum });
          if (sw.w === 0) sw.ws = wkNum;
          sw.w += 1;
          sw.l = 0;
          if (!streakW || sw.w > streakW.val)
            streakW = {
              val: sw.w,
              who: `${winN?.team} (${winN?.owner})`,
              sub: `${b.season} · WK ${sw.ws}–${wkNum}`,
            };
          const sl = (st[lr] ??= { w: 0, ws: wkNum, l: 0, ls: wkNum });
          if (sl.l === 0) sl.ls = wkNum;
          sl.l += 1;
          sl.w = 0;
          if (!streakL || sl.l > streakL.val)
            streakL = {
              val: sl.l,
              who: `${loseN?.team} (${loseN?.owner})`,
              sub: `${b.season} · WK ${sl.ls}–${wkNum}`,
            };
        }
      });
    });
  });

  return { hiWk, loWk, blow, close, shootout, bestLoss, worstWin, streakW, streakL, bestRec, hiPF, loPF, hiPA };
}
