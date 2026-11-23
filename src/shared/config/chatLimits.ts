/** The chat transcript's limits, enforced by netlify/functions/chat.ts and
    respected by widgets/chatbot before it sends. One source: when these were
    two copies, the client sent what the server rejected, and a rejected turn
    replayed on every later request broke the chat until reload (PR #5). */
export const MAX_TURNS = 40; // whole conversation
export const MAX_MESSAGE_CHARS = 2000; // per message, the assistant's replies included
