import type { StandingRow } from '@/entities/team/model/types';
import type { NextDraft } from '@/entities/draft/lib/nextDraft';
import type { BracketGame, LeagueStatus } from '@/shared/api/types';
import { fmt, fmtEventDate } from '@/shared/lib/format';

interface TickerInput {
  season: string | undefined;
  status: LeagueStatus | undefined;
  standings: StandingRow[] | undefined;
  winners: BracketGame[] | undefined;
  savage: boolean;
  /** Real upcoming draft from the chain's newest league; undefined while loading. */
  nextDraft?: NextDraft | null;
}

/** The League Wire line. Mirrors legacy renderVals ticker logic. */
export function tickerText({ season, status, standings, winners, savage, nextDraft }: TickerInput): string {
  const complete = status === 'complete';
  const preDraft = status === 'pre_draft' || status === 'drafting';
  const stand = standings ?? [];
  const byRoster: Record<number, StandingRow> = {};
  stand.forEach((r) => (byRoster[r.rosterId] = r));

  const fin = (winners ?? []).find((g) => g.p === 1);
  const champ = fin && typeof fin.w === 'number' ? byRoster[fin.w] : undefined;
  const pfKing = stand.length ? [...stand].sort((a, b) => b.pf - a.pf)[0] : undefined;
  const sacko = stand.length ? stand[stand.length - 1] : undefined;
  const nextDraftYear = nextDraft ? Number(nextDraft.season) : preDraft ? Number(season) : Number(season ?? 2025) + 1;

  const bits: string[] = [];
  if (champ) bits.push(`${champ.team} CLAIMS THE ${season} TITLE`.toUpperCase());
  if (pfKing && pfKing.pf > 0) bits.push(`${pfKing.team} DROPPED A LEAGUE-HIGH ${fmt(pfKing.pf)} PF`.toUpperCase());
  if (sacko && complete)
    bits.push(`${sacko.team} (${sacko.w}–${sacko.l}): PUNISHMENT PENDING${savage ? '. NO APPEALS' : ''}`.toUpperCase());
  if (preDraft) {
    bits.unshift(`THE ${season} LEAGUE IS LIVE ON SLEEPER — ROSTERS EMPTY, EGOS FULL`);
    bits.push('EVERYONE IS UNDEFEATED. ENJOY IT WHILE IT LASTS');
  }
  if (nextDraft?.startTime) {
    bits.push(
      `DRAFT ${nextDraftYear}: ${fmtEventDate(nextDraft.startTime)}${savage ? ' — BE THERE OR GET AUTOPICKED' : ' — MARK YOUR CALENDAR'}`,
    );
  } else {
    bits.push(`DRAFT ${nextDraftYear}: DATE TBD — COMMISH, SET IT`);
  }
  if (savage) bits.push('TRADE RUMORS: FABRICATED. TENSION: REAL');
  return bits.length ? bits.join('   ▪   ') : 'M$G LEAGUE WIRE — WARMING UP THE TELETYPE…';
}
