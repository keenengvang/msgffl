import { describe, expect, it } from 'vitest';
import { MAX_TURNS, windowTurns, type ChatTurn } from './sendChat';

const user = (n: number): ChatTurn => ({ role: 'user', content: `q${n}` });
const bot = (n: number): ChatTurn => ({ role: 'assistant', content: `a${n}` });

/** A transcript of alternating turns, oldest first, starting with the user. */
const thread = (pairs: number): ChatTurn[] =>
  Array.from({ length: pairs }, (_, i) => [user(i), bot(i)]).flat();

describe('windowTurns', () => {
  it('passes short transcripts through untouched', () => {
    const turns = thread(3);
    expect(windowTurns(turns)).toEqual(turns);
  });

  it('keeps the newest turns once the transcript outgrows the cap', () => {
    const turns = [...thread(30), user(99)];
    const sent = windowTurns(turns);

    expect(sent.length).toBeLessThanOrEqual(MAX_TURNS);
    expect(sent.at(-1)).toEqual(user(99));
    expect(sent).not.toContainEqual(user(0));
  });

  it('opens on a user turn, since Claude rejects a leading assistant turn', () => {
    // An even-length window over this transcript would start on an assistant reply.
    const turns = [...thread(MAX_TURNS / 2), user(99)];
    expect(windowTurns(turns)[0]!.role).toBe('user');
  });
});
