import { describe, expect, it } from 'vitest';
import { defaultWeek, weekLabel } from './weekLabels';

describe('weekLabel', () => {
  it('labels regular and playoff weeks', () => {
    expect(weekLabel(3, 15)).toBe('WK 3');
    expect(weekLabel(15, 15)).toBe('QF W15');
    expect(weekLabel(16, 15)).toBe('SEMI W16');
    expect(weekLabel(17, 15)).toBe('SHIP W17');
  });
});

describe('defaultWeek', () => {
  it('uses the title week for complete seasons (capped at 17)', () => {
    expect(defaultWeek({ status: 'complete', playoffWeekStart: 15, nflSeason: '2025', nflWeek: 3, season: '2024' })).toBe(17);
    expect(defaultWeek({ status: 'complete', playoffWeekStart: 16, nflSeason: '2025', nflWeek: 3, season: '2024' })).toBe(17);
  });

  it('uses the live NFL week only when it belongs to this season', () => {
    expect(defaultWeek({ status: 'in_season', playoffWeekStart: 15, nflSeason: '2025', nflWeek: 7, season: '2025' })).toBe(7);
    expect(defaultWeek({ status: 'in_season', playoffWeekStart: 15, nflSeason: '2025', nflWeek: 7, season: '2024' })).toBe(1);
  });
});
