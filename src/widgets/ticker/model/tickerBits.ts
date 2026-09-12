import type { StandingRow } from '@/entities/team/model/types';
import type { NextDraft } from '@/entities/draft/lib/nextDraft';
import type { WeekPulse } from '@/entities/matchup/lib/liveWeek';
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
  /** The week the season is on, and what's on the board in it. */
  week?: number;
  pulse?: WeekPulse;
  playoffWeekStart?: number;
}

/** The League Wire line. Mirrors legacy renderVals ticker logic. */
export function tickerText({
  season,
  status,
  standings,
  winners,
  savage,
  nextDraft,
  week,
  pulse,
  playoffWeekStart,
}: TickerInput): string {
  const complete = status === 'complete';
  const preDraft = status === 'pre_draft' || status === 'drafting';
  const inSeason = status === 'in_season';
  const stand = standings ?? [];
  const byRoster: Record<number, StandingRow> = {};
  stand.forEach((r) => (byRoster[r.rosterId] = r));
  const teamOf = (rosterId: number) => byRoster[rosterId]?.team ?? `ROSTER ${rosterId}`;

  const fin = (winners ?? []).find((g) => g.p === 1);
  const champ = fin && typeof fin.w === 'number' ? byRoster[fin.w] : undefined;
  const pfKing = stand.length ? [...stand].sort((a, b) => b.pf - a.pf)[0] : undefined;
  const sacko = stand.length ? stand[stand.length - 1] : undefined;
  const nextDraftYear = nextDraft ? Number(nextDraft.season) : preDraft ? Number(season) : Number(season ?? 2025) + 1;

  const bits: string[] = [];

  // A live week leads. Season totals lag a week behind on Sleeper, so without
  // this the wire has nothing to say while games are actually being played.
  if (inSeason && week && pulse && pulse.games > 0) {
    if (pulse.scored > 0) {
      bits.push(`WEEK ${week} IS LIVE — ${pulse.scored} OF ${pulse.games} GAMES ON THE BOARD`);
      if (pulse.top) {
        bits.push(`TOP SCORE SO FAR: ${teamOf(pulse.top.rosterId)} ${fmt(pulse.top.points)}`.toUpperCase());
      }
      if (pulse.closest) {
        bits.push(
          `TIGHTEST GAME: ${teamOf(pulse.closest.winner)} OVER ${teamOf(pulse.closest.loser)} BY ${fmt(pulse.closest.margin)}`.toUpperCase(),
        );
      }
    } else {
      bits.push(
        `WEEK ${week} IS ON DECK${savage ? ' — SET YOUR LINEUP OR EXPLAIN YOURSELF LATER' : ' — LINEUPS LOCK AT KICKOFF'}`,
      );
    }
  }

  if (champ) bits.push(`${champ.team} CLAIMS THE ${season} TITLE`.toUpperCase());
  if (pfKing && pfKing.pf > 0) bits.push(`${pfKing.team} DROPPED A LEAGUE-HIGH ${fmt(pfKing.pf)} PF`.toUpperCase());
  if (sacko && complete)
    bits.push(`${sacko.team} (${sacko.w}–${sacko.l}): PUNISHMENT PENDING${savage ? '. NO APPEALS' : ''}`.toUpperCase());
  if (preDraft) {
    bits.unshift(`THE ${season} LEAGUE IS LIVE ON SLEEPER — ROSTERS EMPTY, EGOS FULL`);
    bits.push('EVERYONE IS UNDEFEATED. ENJOY IT WHILE IT LASTS');
  }

  // While a season is running the next draft is a year out and Sleeper hasn't
  // minted that league — the playoff race is the deadline that actually matters.
  if (inSeason && week) {
    const pws = playoffWeekStart ?? 15;
    if (week < pws) {
      const togo = pws - week;
      bits.push(
        `PLAYOFFS START WEEK ${pws} — ${togo} WEEK${togo === 1 ? '' : 'S'} ${savage ? 'TO FIX WHATEVER THAT ROSTER IS' : 'TO MAKE YOUR CASE'}`,
      );
    } else {
      bits.push(`PLAYOFF FOOTBALL — WIN OR ${savage ? 'EXPLAIN YOURSELF' : 'GO HOME'}`);
    }
  } else if (nextDraft?.startTime) {
    bits.push(
      `DRAFT ${nextDraftYear}: ${fmtEventDate(nextDraft.startTime)}${savage ? ' — BE THERE OR GET AUTOPICKED' : ' — MARK YOUR CALENDAR'}`,
    );
  } else {
    bits.push(`DRAFT ${nextDraftYear}: DATE TBD — COMMISH, SET IT`);
  }

  if (savage) bits.push('TRADE RUMORS: FABRICATED. TENSION: REAL');
  return bits.length ? bits.join('   ▪   ') : 'M$G LEAGUE WIRE — WARMING UP THE TELETYPE…';
}
