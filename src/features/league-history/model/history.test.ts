import { describe, expect, it } from 'vitest';
import type { StandingRow } from '@/entities/team/model/types';
import type { SeasonBundle } from './buildSeasonBundle';
import { aggregateAllTime } from './aggregateAllTime';
import { recordBook } from './recordBook';
import { h2h } from './h2h';

const row = (rosterId: number, ownerId: string, w: number, pf: number, pa = 1000): StandingRow => ({
  rosterId,
  ownerId,
  team: `Team ${ownerId}`,
  owner: ownerId,
  avatar: '',
  w,
  l: 14 - w,
  t: 0,
  pf,
  pa,
  recordStr: '',
});

/** Two-team-focused bundle: weeks are [matchup entries per week]. */
const bundle = (season: string, standings: StandingRow[], weeks: SeasonBundle['weeks'], champId?: string, pws = 15): SeasonBundle => {
  const names: SeasonBundle['names'] = {};
  standings.forEach((r) => (names[r.rosterId] = { team: r.team, owner: r.owner, ownerId: r.ownerId, av: '' }));
  const champRow = standings.find((r) => r.ownerId === champId);
  return {
    season,
    status: 'complete',
    names,
    standings,
    weeks,
    champ: champRow ? names[champRow.rosterId]! : null,
    ru: null,
    sacko: standings[standings.length - 1] ?? null,
    pws,
  };
};

const e = (m: number, r: number, p: number) => ({ m, r, p });

describe('aggregateAllTime', () => {
  it('sums W/L/PF and counts titles, sackos, seasons per owner', () => {
    const b1 = bundle('2023', [row(1, 'a', 10, 1500), row(2, 'b', 4, 1200)], [], 'a');
    const b2 = bundle('2024', [row(1, 'b', 9, 1400), row(2, 'a', 5, 1300)], [], 'b');
    const { agg } = aggregateAllTime([b1, b2]);
    expect(agg['a']).toMatchObject({ w: 15, l: 13, titles: 1, sackos: 1, seasons: 2 });
    expect(agg['a']!.pf).toBeCloseTo(2800);
    expect(agg['b']).toMatchObject({ w: 13, l: 15, titles: 1, sackos: 1, seasons: 2 });
  });
});

describe('recordBook', () => {
  const standings = [row(1, 'a', 8, 1500), row(2, 'b', 6, 1400, 1600)];
  const weeks: SeasonBundle['weeks'] = [
    [e(1, 1, 180.5), e(1, 2, 60.25)], // wk1: hiWk 180.5, loWk 60.25, blow 120.25
    [e(1, 1, 100), e(1, 2, 99.5)], // wk2: close 0.5
    [e(1, 1, 0), e(1, 2, 0)], // wk3: unplayed — must be skipped
  ];

  it('finds highest/lowest week, blowout, closest game', () => {
    const rc = recordBook([bundle('2024', standings, weeks)]);
    expect(rc.hiWk).toMatchObject({ val: 180.5, who: 'Team a (a)' });
    expect(rc.hiWk!.sub).toContain('WK 1 · 2024');
    expect(rc.loWk).toMatchObject({ val: 60.25 });
    expect(rc.blow!.val).toBeCloseTo(120.25);
    expect(rc.blow!.who).toBe('Team a over Team b');
    expect(rc.close!.val).toBeCloseTo(0.5);
  });

  it('skips 0–0 unplayed pairs entirely (lowest week is never 0)', () => {
    const rc = recordBook([bundle('2024', standings, weeks)]);
    expect(rc.loWk!.val).toBeGreaterThan(0);
  });

  it('season records come from standings PF/PA', () => {
    const rc = recordBook([bundle('2024', standings, weeks)]);
    expect(rc.hiPF).toMatchObject({ val: 1500, who: 'Team a (a)' });
    expect(rc.hiPA).toMatchObject({ val: 1600, who: 'Team b (b)' });
  });
});

describe('recordBook — extended records', () => {
  // a beats b wk1–2 (regular season), then again wk15 (playoffs, pws 15).
  const standings = [row(1, 'a', 8, 1500), row(2, 'b', 6, 1400, 1600)];
  const weeks: SeasonBundle['weeks'] = Array.from({ length: 17 }, () => []);
  weeks[0] = [e(1, 1, 120), e(1, 2, 100)];
  weeks[1] = [e(1, 1, 110), e(1, 2, 90)];
  weeks[14] = [e(1, 1, 150), e(1, 2, 60)];
  const rc = recordBook([bundle('2024', standings, weeks)]);

  it('finds highest combined game, best loss, worst win (playoffs included)', () => {
    expect(rc.shootout).toMatchObject({ val: 220, who: 'Team a vs Team b' });
    expect(rc.shootout!.sub).toContain('WK 1 · 2024');
    expect(rc.bestLoss).toMatchObject({ val: 100, who: 'Team b (b)' });
    expect(rc.worstWin).toMatchObject({ val: 110, who: 'Team a (a)' });
  });

  it('streaks count regular season only — the wk15 playoff win does not extend', () => {
    expect(rc.streakW).toMatchObject({ val: 2, who: 'Team a (a)' });
    expect(rc.streakW!.sub).toContain('WK 1–2');
    expect(rc.streakL).toMatchObject({ val: 2, who: 'Team b (b)' });
  });

  it('best record and lowest PF come from complete seasons only', () => {
    expect(rc.bestRec).toMatchObject({ val: 8, who: 'Team a (a)' });
    expect(rc.bestRec!.sub).toContain('8–6');
    expect(rc.loPF).toMatchObject({ val: 1400, who: 'Team b (b)' });
    // an in-progress season with a tiny partial PF must not steal the record
    const partial = { ...bundle('2025', [row(1, 'c', 2, 200)], []), status: 'in_season' as const };
    const rc2 = recordBook([bundle('2024', standings, weeks), partial]);
    expect(rc2.loPF).toMatchObject({ val: 1400, who: 'Team b (b)' });
    expect(rc2.bestRec).toMatchObject({ val: 8, who: 'Team a (a)' });
  });

  it('a tie snaps both streaks', () => {
    const w2: SeasonBundle['weeks'] = [
      [e(1, 1, 120), e(1, 2, 100)], // a W1
      [e(1, 1, 100), e(1, 2, 100)], // tie — both reset
      [e(1, 1, 130), e(1, 2, 90)], // a W1 again
    ];
    const r2 = recordBook([bundle('2024', standings, w2)]);
    expect(r2.streakW!.val).toBe(1);
  });
});

describe('h2h', () => {
  it('counts regular-season wins only; playoff weeks and ties are excluded', () => {
    const standings = [row(1, 'a', 8, 1500), row(2, 'b', 6, 1400)];
    const weeks: SeasonBundle['weeks'] = Array.from({ length: 17 }, () => []);
    weeks[0] = [e(1, 1, 120), e(1, 2, 100)]; // wk1: a beats b
    weeks[1] = [e(1, 1, 90), e(1, 2, 110)]; // wk2: b beats a
    weeks[2] = [e(1, 1, 100), e(1, 2, 100)]; // wk3: tie — not counted
    weeks[15] = [e(1, 1, 150), e(1, 2, 80)]; // wk16 ≥ pws 15: playoff — excluded
    const map = h2h([bundle('2024', standings, weeks)]);
    expect(map['a']!['b']).toEqual({ w: 1, l: 1 });
    expect(map['b']!['a']).toEqual({ w: 1, l: 1 });
  });
});
