import { describe, expect, it } from 'vitest';
import { stringToStyle, styleToString } from './style';

describe('stringToStyle', () => {
  it('parses simple style strings', () => {
    expect(stringToStyle('color: red;')).toEqual({
      color: 'red',
    });
  });

  it('parses multiple declarations', () => {
    expect(stringToStyle('color: red; background: blue;')).toEqual({
      color: 'red',
      background: 'blue',
    });
  });

  it('converts kebab-case keys to camelCase', () => {
    expect(stringToStyle('background-color: red; font-size: 12px;')).toEqual({
      backgroundColor: 'red',
      fontSize: '12px',
    });
  });

  it('handles values containing colons (URLs)', () => {
    expect(
      stringToStyle(
        'background: url(https://example.com/a:b.png); color: red;',
      ),
    ).toEqual({
      background: 'url(https://example.com/a:b.png)',
      color: 'red',
    });
  });

  it('ignores invalid rules safely', () => {
    expect(stringToStyle('color: red; invalid-rule; : blue;')).toEqual({
      color: 'red',
    });
  });

  it('trims whitespace properly', () => {
    expect(stringToStyle('  color  :   red  ;  ')).toEqual({
      color: 'red',
    });
  });

  it('returns empty object for empty input', () => {
    expect(stringToStyle('')).toEqual({});
  });

  it('ignores trailing semicolons', () => {
    expect(stringToStyle('color: red;;;')).toEqual({
      color: 'red',
    });
  });
});

describe('styleToString', () => {
  it('converts camelCase to kebab-case', () => {
    expect(
      styleToString({
        textAlign: 'center',
        backgroundColor: 'red',
      }),
    ).toBe('text-align: center; background-color: red');
  });

  it('handles numbers', () => {
    expect(
      styleToString({
        width: 200,
      }),
    ).toBe('width: 200');
  });

  it('filters empty values', () => {
    expect(
      styleToString({
        color: '',
        width: 100,
      }),
    ).toBe('width: 100');
  });

  it('returns empty string for empty object', () => {
    expect(styleToString({})).toBe('');
  });
  it('filters mixed invalid values', () => {
    expect(
      styleToString({
        textAlign: null as any,
        color: undefined as any,
        width: '',
        height: 100,
      }),
    ).toBe('height: 100');
  });
});
