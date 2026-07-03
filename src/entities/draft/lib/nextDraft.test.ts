import { describe, expect, it } from 'vitest';
import type { Draft } from '@/shared/api/types';
import { nextDraftInfo } from './nextDraft';

const draft = (over: Partial<Draft>): Draft => ({
  draft_id: 'd1',
  status: 'pre_draft',
  season: '2026',
  ...over,
});

describe('nextDraftInfo', () => {
  it('returns the newest league draft with its scheduled start', () => {
    expect(nextDraftInfo('2026', draft({ start_time: 1787608831000 }))).toEqual({
      season: '2026',
      startTime: 1787608831000,
    });
  });

  it('returns null startTime while the commish has not scheduled it', () => {
    expect(nextDraftInfo('2026', draft({ start_time: null }))).toEqual({ season: '2026', startTime: null });
    expect(nextDraftInfo('2026', null)).toEqual({ season: '2027', startTime: null });
  });

  it('rolls to next season once the draft is complete', () => {
    expect(nextDraftInfo('2025', draft({ season: '2025', status: 'complete', start_time: 123 }))).toEqual({
      season: '2026',
      startTime: null,
    });
  });

  it('returns null without a chain', () => {
    expect(nextDraftInfo(undefined, null)).toBeNull();
  });
});
