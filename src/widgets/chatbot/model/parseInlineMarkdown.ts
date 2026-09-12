export interface InlineToken {
  type: 'text' | 'bold' | 'italic';
  value: string;
}

/** Claude's replies are plain prose that leans on **bold** and *italic* for
    emphasis — never headings, links, or lists, per the chat system prompt's
    "keep answers short" rule. So this only needs to split those two inline
    spans out; everything else (including raw newlines) stays as text and
    renders through the bubble's own `white-space: pre-wrap`. */
export function parseInlineMarkdown(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    const [, boldStar, boldUnder, italicStar, italicUnder] = match;
    const isBold = boldStar !== undefined || boldUnder !== undefined;
    tokens.push({ type: isBold ? 'bold' : 'italic', value: boldStar ?? boldUnder ?? italicStar ?? italicUnder ?? '' });
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) tokens.push({ type: 'text', value: text.slice(lastIndex) });

  return tokens;
}
