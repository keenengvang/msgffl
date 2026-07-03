import type { BracketGame, SeasonWeeks } from '@/shared/api/types';
import type { StandingRow } from '@/entities/team/model/types';
import { fmt } from '@/shared/lib/format';

export interface BracketSide {
  name: string;
  tag: string;
  win: boolean;
}

export interface BracketGameView {
  key: string;
  a: BracketSide;
  b: BracketSide;
  isTitle: boolean;
  label: string;
}

export interface BracketRound {
  title: string;
  games: BracketGameView[];
}

function rosterOf(t: BracketGame['t1']): number | null {
  return typeof t === 'number' ? t : null;
}

/** Shape the winners bracket into titled rounds with TBD / WINNER G# resolution.
    Decided games tag each side `W · pts` / `L · pts` from that round's week
    (round N plays week pws + N - 1); without scores they fall back to W / seed
    record, and undecided games preview the seed record. */
export function bracketRounds(
  winners: BracketGame[],
  names: Record<number, StandingRow>,
  weeks?: SeasonWeeks,
  pws = 15,
): BracketRound[] {
  const maxR = Math.max(...winners.map((g) => g.r));
  const rTitle = (r: number) => (r === maxR ? 'CHAMPIONSHIP' : r === maxR - 1 ? 'SEMIFINALS' : `ROUND ${r}`);
  const nameOf = (t: BracketGame['t1'], from?: { w?: number; l?: number }) => {
    const rid = rosterOf(t);
    if (rid != null && names[rid]) return names[rid].team;
    if (from?.w) return `WINNER G${from.w}`;
    if (from?.l) return `LOSER G${from.l}`;
    return 'TBD';
  };
  const recOf = (t: BracketGame['t1']) => {
    const rid = rosterOf(t);
    return rid != null && names[rid] ? `${names[rid].w}–${names[rid].l}` : '';
  };
  const ptsOf = (t: BracketGame['t1'], round: number): number | null => {
    const rid = rosterOf(t);
    if (rid == null) return null;
    const p = (weeks?.[pws + round - 1] ?? []).find((e) => e.r === rid)?.p ?? 0;
    return p > 0 ? p : null;
  };
  const tagOf = (t: BracketGame['t1'], win: boolean, decided: boolean, round: number) => {
    if (decided) {
      const p = ptsOf(t, round);
      if (p != null) return `${win ? 'W' : 'L'} · ${fmt(p)}`;
      if (win) return 'W';
    }
    return recOf(t);
  };

  const grouped: Record<number, BracketGame[]> = {};
  winners.forEach((g) => (grouped[g.r] ??= []).push(g));

  return Object.keys(grouped)
    .sort((a, b) => Number(a) - Number(b))
    .map((r) => ({
      title: rTitle(Number(r)),
      games: grouped[Number(r)]!
        .sort((a, b) => (a.p || 99) - (b.p || 99) || a.m - b.m)
        .map((g) => {
          const decided = g.w != null;
          const aWin = !!g.w && g.w === rosterOf(g.t1);
          const bWin = !!g.w && g.w === rosterOf(g.t2);
          const champName = g.w != null && names[g.w] ? names[g.w]!.team.toUpperCase() : '';
          return {
            key: `${r}-${g.m}`,
            a: { name: nameOf(g.t1, g.t1_from), tag: tagOf(g.t1, aWin, decided, Number(r)), win: aWin },
            b: { name: nameOf(g.t2, g.t2_from), tag: tagOf(g.t2, bWin, decided, Number(r)), win: bWin },
            isTitle: g.p === 1,
            label:
              g.p === 1
                ? g.w
                  ? `★ TITLE GAME — ${champName} TAKES THE BELT`
                  : '★ TITLE GAME'
                : g.p === 3
                  ? 'BRONZE — NOBODY BRAGS ABOUT THIS'
                  : '',
          };
        }),
    }));
}
