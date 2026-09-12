import { describe, it, expect } from 'vitest';
import { splitParagraphs } from './splitParagraphs';

describe('splitParagraphs', () => {
  it('returns a single-paragraph body unchanged', () => {
    expect(splitParagraphs('One long roast about a kicker.')).toEqual([
      'One long roast about a kicker.',
    ]);
  });

  it('splits on blank lines', () => {
    expect(splitParagraphs('First para.\n\nSecond para.')).toEqual(['First para.', 'Second para.']);
  });

  it('treats a blank line with whitespace as a break', () => {
    expect(splitParagraphs('First.\n   \nSecond.')).toEqual(['First.', 'Second.']);
  });

  it('keeps single newlines inside a paragraph', () => {
    expect(splitParagraphs('Line one\nline two')).toEqual(['Line one\nline two']);
  });

  it('drops trailing and leading blank space', () => {
    expect(splitParagraphs('\n\n  Only para.  \n\n')).toEqual(['Only para.']);
  });

  it('returns an empty list for an empty or blank body', () => {
    expect(splitParagraphs('')).toEqual([]);
    expect(splitParagraphs('   \n  \n ')).toEqual([]);
  });
});
