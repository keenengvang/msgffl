import type { Snark } from '@/shared/config/constants';
import { useMutation } from '@tanstack/react-query';

import { MAX_MESSAGE_CHARS, MAX_TURNS } from '@/shared/config/chatLimits';

export { MAX_MESSAGE_CHARS, MAX_TURNS };

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

export interface ChatRequest {
  messages: ChatTurn[];
  /** Mirrors the site's vibes toggle so the analyst's mouth matches the rest
      of the copy — the function picks a savage or polite persona from it. */
  snark: Snark;
}

/** Ask the league analyst (Netlify Function → Claude). The API is stateless,
    so the caller owns the transcript and sends all of it every time — windowed
    here so a long chat trims its oldest turns instead of being rejected. The
    league data is the server's job: it builds the brief and runs the tools. */
export function useSendChat() {
  return useMutation({
    mutationFn: async ({ messages, snark }: ChatRequest): Promise<string> => {
      const r = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: windowTurns(messages), snark }),
      });
      if (!r.ok) {
        // eslint-disable-next-line no-restricted-syntax -- parses an error body that may not be JSON; the request still throws on the next line (reviewed 2026-11-23)
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `the analyst said no (${r.status})`);
      }
      const { text } = (await r.json()) as { text: string };
      return text;
    },
  });
}
