import { describe, expect, it } from 'vitest';
import { processAttrs, stringToStyle, styleToString } from './style';

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

describe('processAttrs', () => {
  it('maps style properties correctly', () => {
    expect(
      processAttrs('paragraph', {
        textAlign: 'center',
      }),
    ).toEqual({
      style: {
        textAlign: 'center',
      },
    });
  });

  it('skips null and undefined values', () => {
    expect(
      processAttrs('paragraph', {
        textAlign: null,
        colspan: undefined,
      }),
    ).toEqual({});
  });

  it('skips empty string values (important fix)', () => {
    expect(
      processAttrs('paragraph', {
        textAlign: '',
      }),
    ).toEqual({});
  });

  it('keeps 0 as valid value', () => {
    expect(
      processAttrs('tableCell', {
        colwidth: 0,
      }),
    ).toEqual({
      style: {
        width: 0,
      },
    });
  });

  it('keeps false as a value in non-style attributes', () => {
    expect(
      processAttrs('paragraph', {
        custom: false,
      }),
    ).toEqual({
      custom: false,
    });
  });

  it('stringifies object values', () => {
    expect(
      processAttrs('paragraph', {
        meta: { a: 1 },
      }),
    ).toEqual({
      meta: '{"a":1}',
    });
  });

  it('applies default attribute mapping', () => {
    expect(
      processAttrs('heading', {
        level: 2,
        textAlign: 'right',
      }),
    ).toEqual({
      'data-level': 2,
      'style': {
        textAlign: 'right',
      },
    });
  });

  it('allows extendAttrMap to override defaults', () => {
    expect(
      processAttrs(
        'paragraph',
        {
          level: 1,
        },
        {
          level: 'data-custom-level',
        },
      ),
    ).toEqual({
      'data-custom-level': 1,
    });
  });

  it('applies styleMap for paragraph', () => {
    expect(
      processAttrs('paragraph', {
        textAlign: 'right',
      }),
    ).toEqual({
      style: {
        textAlign: 'right',
      },
    });
  });

  it('handles array values with px conversion', () => {
    expect(
      processAttrs('tableCell', {
        colwidth: [200],
      }),
    ).toEqual({
      style: {
        width: '200px',
      },
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
