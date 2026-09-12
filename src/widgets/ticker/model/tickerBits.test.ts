import { describe, expect, it } from 'vitest';
import type { StandingRow } from '@/entities/team/model/types';
import { tickerText } from './tickerBits';

const row = (rosterId: number, team: string, pf = 0): StandingRow => ({
  rosterId,
  ownerId: `u${rosterId}`,
  team,
  owner: `owner${rosterId}`,
  avatar: '',
  w: 0,
  l: 0,
  t: 0,
  pf,
  pa: 0,
  recordStr: '',
});

const standings = [row(1, 'Team One'), row(3, 'Team Three'), row(4, 'Team Four')];

const live = {
  season: '2026',
  status: 'in_season' as const,
  standings,
  winners: undefined,
  savage: true,
  nextDraft: { season: '2027', startTime: null },
  week: 1,
};

describe('tickerText — live week', () => {
  it('leads with the live week when games are on the board', () => {
    const text = tickerText({
      ...live,
      pulse: { games: 7, scored: 4, top: { rosterId: 1, points: 129.45 }, closest: { winner: 3, loser: 4, margin: 1.2 } },
    });
    expect(text.startsWith('WEEK 1 IS LIVE — 4 OF 7 GAMES ON THE BOARD')).toBe(true);
    expect(text).toContain('TOP SCORE SO FAR: TEAM ONE 129.45');
    expect(text).toContain('TIGHTEST GAME: TEAM THREE OVER TEAM FOUR BY 1.20');
  });

  it('says the week is on deck before anyone scores', () => {
    const text = tickerText({ ...live, pulse: { games: 7, scored: 0, top: null, closest: null } });
    expect(text).toContain('WEEK 1 IS ON DECK');
    expect(text).not.toContain('ON THE BOARD');
  });

  it('keeps next season’s draft out of the wire entirely while a season runs', () => {
    const text = tickerText({ ...live, pulse: { games: 7, scored: 4, top: null, closest: null } });
    expect(text).not.toContain('DRAFT');
    expect(text).toContain('PLAYOFFS START WEEK 15 — 14 WEEKS');
  });

  it('switches to playoff copy once the bracket week arrives', () => {
    const text = tickerText({
      ...live,
      week: 15,
      playoffWeekStart: 15,
      pulse: { games: 4, scored: 4, top: null, closest: null },
    });
    expect(text).toContain('PLAYOFF FOOTBALL');
    expect(text).not.toContain('PLAYOFFS START');
  });

  it('still nags in the offseason, when there is a draft to schedule', () => {
    const text = tickerText({ ...live, status: 'pre_draft', week: undefined, pulse: undefined });
    expect(text).toContain('COMMISH, SET IT');
  });

  it('keeps season totals out of the wire until they exist', () => {
    // Sleeper reports 0 PF for every roster until the week rolls up.
    const text = tickerText({ ...live, pulse: { games: 7, scored: 1, top: null, closest: null } });
    expect(text).not.toContain('LEAGUE-HIGH');
  });
});
