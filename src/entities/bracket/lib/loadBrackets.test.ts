import { describe, expect, it } from 'vitest';
import type { BracketGame } from '@/shared/api/types';
import { loadBrackets } from './loadBrackets';

const title: BracketGame = { r: 3, m: 7, t1: 1, t2: 2, w: 2, l: 1, p: 1 } as BracketGame;

describe('loadBrackets', () => {
  it('returns both brackets; a bracket Sleeper has not drawn yet (null) is empty', async () => {
    const b = await loadBrackets(async (side) => (side === 'winners' ? [title] : null));
    expect(b).toEqual({ winners: [title], losers: [] });
  });

  it('rejects when either bracket fails, instead of a season with no champion', async () => {
    await expect(
      loadBrackets(async (side) => {
        if (side === 'winners') throw new Error('Sleeper said no (502)');
        return [];
      }),
    ).rejects.toThrow('502');
  });
});
