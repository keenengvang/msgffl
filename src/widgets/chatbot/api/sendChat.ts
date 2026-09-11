import { useMutation } from '@tanstack/react-query';

/** One turn of the conversation. Mirrors the Messages API shape the function
    forwards to Claude, minus every content type we don't send. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Ask the league analyst (Netlify Function → Claude). The API is stateless,
    so the caller owns the transcript and sends all of it every time. */
export function useSendChat() {
  return useMutation({
    mutationFn: async (messages: ChatTurn[]): Promise<string> => {
      const r = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages }),
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
