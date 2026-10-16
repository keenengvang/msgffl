import { describe, expect, it } from 'vitest';
import type { WeeklySummaryIndexEntry } from '../model/types';
import { sortWeeklySummaryEntries } from './sortEntries';

const e = (season: string, week: number): WeeklySummaryIndexEntry => ({
  season,
  week,
  generatedAt: '',
  headline: '',
  file: `${season}-w${String(week).padStart(2, '0')}.json`,
});

describe('sortWeeklySummaryEntries', () => {
  it('newest season first, then newest week — whatever order the manifest is in', () => {
    const out = sortWeeklySummaryEntries([e('2025', 17), e('2026', 2), e('2026', 5), e('2025', 3)]);
    expect(out.map((x) => x.file)).toEqual(['2026-w05.json', '2026-w02.json', '2025-w17.json', '2025-w03.json']);
  });

  it('drops anything below week 1 — a template is never a recap', () => {
    expect(sortWeeklySummaryEntries([e('2026', 0), e('2026', 1)]).map((x) => x.week)).toEqual([1]);
  });
});
