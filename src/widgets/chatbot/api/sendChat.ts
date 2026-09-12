import { useMutation } from '@tanstack/react-query';

/** Mirrors the limits enforced by netlify/functions/chat.ts — keep in step. */
export const MAX_TURNS = 40;
export const MAX_MESSAGE_CHARS = 2000;

/** One turn of the conversation. Mirrors the Messages API shape the function
    forwards to Claude, minus every content type we don't send. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** The trailing slice of the transcript that fits the server's turn cap.
    Claude requires the first message to be a user turn, so a window that
    opens on an assistant reply drops it rather than sending a 400. */
export function windowTurns(turns: ChatTurn[]): ChatTurn[] {
  const recent = turns.slice(-MAX_TURNS);
  const firstUser = recent.findIndex((t) => t.role === 'user');
  return firstUser > 0 ? recent.slice(firstUser) : recent;
}

/** Ask the league analyst (Netlify Function → Claude). The API is stateless,
    so the caller owns the transcript and sends all of it every time — windowed
    here so a long chat trims its oldest turns instead of being rejected. */
export function useSendChat() {
  return useMutation({
    mutationFn: async (messages: ChatTurn[]): Promise<string> => {
      const r = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: windowTurns(messages) }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `the analyst said no (${r.status})`);
      }
      const { text } = (await r.json()) as { text: string };
      return text;
    },
  });
}
