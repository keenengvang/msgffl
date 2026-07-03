import { describe, expect, it } from 'vitest';
import { fmt, fmt0, ord } from './format';

describe('fmt', () => {
  it('always shows two decimals with thousands separators', () => {
    expect(fmt(1847.625)).toBe('1,847.63');
    expect(fmt(0)).toBe('0.00');
    expect(fmt(null)).toBe('0.00');
  });
});

describe('fmt0', () => {
  it('rounds to whole numbers', () => {
    expect(fmt0(1847.62)).toBe('1,848');
  });
});

describe('ord', () => {
  it('handles teens and ordinary suffixes', () => {
    expect(ord(1)).toBe('1st');
    expect(ord(2)).toBe('2nd');
    expect(ord(3)).toBe('3rd');
    expect(ord(4)).toBe('4th');
    expect(ord(11)).toBe('11th');
    expect(ord(12)).toBe('12th');
    expect(ord(13)).toBe('13th');
    expect(ord(21)).toBe('21st');
    expect(ord(111)).toBe('111th');
  });
});
