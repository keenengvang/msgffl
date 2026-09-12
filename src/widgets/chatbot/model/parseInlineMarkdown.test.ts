import { describe, it, expect } from 'vitest';
import { parseInlineMarkdown } from './parseInlineMarkdown';

describe('parseInlineMarkdown', () => {
  it('returns plain text unchanged as a single text token', () => {
    expect(parseInlineMarkdown('no formatting here')).toEqual([{ type: 'text', value: 'no formatting here' }]);
  });

  it('splits out a bold span', () => {
    expect(parseInlineMarkdown('the verdict: **benched**')).toEqual([
      { type: 'text', value: 'the verdict: ' },
      { type: 'bold', value: 'benched' },
    ]);
  });

  it('splits out an italic span', () => {
    expect(parseInlineMarkdown('that was *rough*')).toEqual([
      { type: 'text', value: 'that was ' },
      { type: 'italic', value: 'rough' },
    ]);
  });

  it('handles bold and italic together', () => {
    expect(parseInlineMarkdown('**start** it, *maybe*.')).toEqual([
      { type: 'bold', value: 'start' },
      { type: 'text', value: ' it, ' },
      { type: 'italic', value: 'maybe' },
      { type: 'text', value: '.' },
    ]);
  });

  it('supports underscore bold and italic', () => {
    expect(parseInlineMarkdown('__bold__ and _italic_')).toEqual([
      { type: 'bold', value: 'bold' },
      { type: 'text', value: ' and ' },
      { type: 'italic', value: 'italic' },
    ]);
  });

  it('leaves raw newlines inside text tokens', () => {
    expect(parseInlineMarkdown('line one\nline two')).toEqual([{ type: 'text', value: 'line one\nline two' }]);
  });

  it('returns an empty list for an empty string', () => {
    expect(parseInlineMarkdown('')).toEqual([]);
  });
});
