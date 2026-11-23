import { describe, expect, it } from 'vitest';
import type { Draft, DraftPick } from '@/shared/api/types';
import { loadDraft } from './loadDraft';

const done = { draft_id: 'D', status: 'complete' } as Draft;
const pick = { pick_no: 1, player_id: '4046' } as DraftPick;

describe('loadDraft', () => {
  it('reads picks only once the draft is complete', async () => {
    expect(await loadDraft(async () => [done], async () => [pick])).toEqual({ draft: done, picks: [pick] });
    const pre = { draft_id: 'D', status: 'pre_draft' } as Draft;
    expect(await loadDraft(async () => [pre], async () => { throw new Error('not called'); })).toEqual({ draft: pre, picks: [] });
    expect(await loadDraft(async () => [], async () => [])).toEqual({ draft: null, picks: [] });
  });

  it('rejects when the picks fail, instead of a complete draft with no picks', async () => {
    await expect(loadDraft(async () => [done], async () => { throw new Error('Sleeper said no (502)'); })).rejects.toThrow('502');
  });

  it('rejects when the drafts list fails, instead of "no draft"', async () => {
    await expect(loadDraft(async () => { throw new Error('Sleeper said no (502)'); }, async () => [])).rejects.toThrow('502');
  });
});
