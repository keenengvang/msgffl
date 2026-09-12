import { useEffect, useRef, useState } from 'react';
import { useVibes } from '@/shared/lib/vibes';
import { MAX_MESSAGE_CHARS, useSendChat, type ChatTurn } from '../api/sendChat';
import styles from './ChatBot.module.css';

const COPY = {
  savage: {
    empty: 'Ask me anything. I promise to judge your roster.',
    placeholder: 'Who should I start, genius?',
    thinking: 'Consulting the film room…',
    send: 'Ask',
    title: 'The Analyst',
    clear: 'Wipe it',
    clearHint: 'Burn the transcript and start over',
    close: 'Close the analyst',
  },
  polite: {
    empty: 'Ask a fantasy football question to get started.',
    placeholder: 'Ask a fantasy question…',
    thinking: 'Thinking…',
    send: 'Send',
    title: 'League Analyst',
    clear: 'Clear',
    clearHint: 'Clear this conversation and start a new one',
    close: 'Close chat',
  },
};

/** Floating chat launcher + conversation panel. Open/close is handled by the
    native popover API — click the button to toggle, click outside or Esc to
    dismiss. The transcript lives in state and is replayed to the function on
    every turn (the Messages API is stateless), so Claude keeps the thread.
    Closing the popover keeps the transcript; a reload starts fresh. */
export function ChatBot() {
  const { snark } = useVibes();
  const copy = snark !== 'polite' ? COPY.savage : COPY.polite;
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const send = useSendChat();
  const bodyRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [turns, send.isPending]);

  /** Start a fresh thread without reloading. The transcript is the whole
      conversation state — the Messages API is stateless and nothing is
      persisted — so dropping it is all "new chat" means. reset() also clears a
      failed mutation, or the last error would outlive the messages it came from. */
  function clearChat() {
    setTurns([]);
    setDraft('');
    send.reset();
  }

  const hasThread = turns.length > 0 || send.isError;

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const question = draft.trim();
    // maxLength on the input is the real guard; this keeps an over-long message
    // from entering the transcript if that is ever bypassed.
    if (!question || question.length > MAX_MESSAGE_CHARS || send.isPending) return;

    const next: ChatTurn[] = [...turns, { role: 'user', content: question }];
    setTurns(next);
    setDraft('');
    try {
      const reply = await send.mutateAsync({ messages: next, snark });
      setTurns([...next, { role: 'assistant', content: reply }]);
    } catch {
      // The thrown message renders below; the user's turn stays in the thread
      // so they can retry without retyping.
    }
  }

  return (
    <>
      <button type="button" popoverTarget="chatbot-panel" className={styles.launcher} aria-label="Chat">
        <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v8a1.5 1.5 0 0 1-1.5 1.5H8l-4 3v-3h.5A1.5 1.5 0 0 1 3 12.5z"
            fill="currentColor"
          />
        </svg>
      </button>
      <div id="chatbot-panel" popover="auto" className={styles.panel}>
        <header className={styles.head}>
          <span className={`uLabel ${styles.title}`}>{copy.title}</span>
          <button
            type="button"
            className={styles.clear}
            onClick={clearChat}
            disabled={!hasThread || send.isPending}
            title={copy.clearHint}
          >
            {copy.clear}
          </button>
          {/* Native popover control — hides the panel with no JS and no state
              of our own. Esc and an outside click already do this; the X is for
              people who reach for one. */}
          <button
            type="button"
            className={styles.close}
            popoverTarget="chatbot-panel"
            popoverTargetAction="hide"
            aria-label={copy.close}
          >
            <svg className={styles.closeIcon} viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M1.5 1.5 12.5 12.5M12.5 1.5 1.5 12.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <div className={styles.body} ref={bodyRef} aria-live="polite">
          {turns.length === 0 && !send.isPending && <p className={styles.muted}>{copy.empty}</p>}
          {turns.map((turn, i) => (
            <p key={i} className={turn.role === 'user' ? styles.fromUser : styles.fromBot}>
              {turn.content}
            </p>
          ))}
          {send.isPending && <p className={styles.muted}>{copy.thinking}</p>}
          {send.isError && <p className={styles.error}>{send.error.message}</p>}
        </div>
        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            className={styles.input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={copy.placeholder}
            maxLength={MAX_MESSAGE_CHARS}
            aria-label="Message"
          />
          <button type="submit" className={styles.send} disabled={send.isPending || !draft.trim()}>
            {copy.send}
          </button>
        </form>
      </div>
    </>
  );
}
