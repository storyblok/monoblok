import { describe, expect, it } from 'vitest';
import { parseDOMSpec } from './parse-dom-spec';

describe('parseDOMSpec', () => {
  it('parses paragraph', () => {
    const result = parseDOMSpec(['p', {}, 0]);
    expect(result).toEqual({
      tag: 'p',
      content: true,
    });
  });

  it('parses ordered list with attributes', () => {
    const result = parseDOMSpec(['ol', { start: 1, order: 1 }, 0]);
    expect(result).toEqual(
      {
        attrs: {
          order: 1,
          start: 1,
        },
        content: true,
        tag: 'ol',
      },
    );
  });

  it('parses nested pre > code', () => {
    const result = parseDOMSpec(['pre', {}, ['code', {}, 0]]);
    expect(result).toEqual(
      {
        children: [
          {
            content: true,
            tag: 'code',
          },
        ],
        tag: 'pre',
      },
    );
  });

  it('filters null style values', () => {
    const result = parseDOMSpec(['span', { style: 'color: null' }, 0]);
    expect(result).toEqual(
      {
        content: true,
        tag: 'span',
      },
    );
  });

  it('filters null data attributes', () => {
    const result = parseDOMSpec([
      'span',
      { 'data-blok': 'null', 'style': 'display: none' },
    ]);
    expect(result).toEqual(
      {
        attrs: {
          style: 'display: none',
        },
        tag: 'span',
      },
    );
  });

  it('filters undefined nested attributes', () => {
    const result = parseDOMSpec([
      'span',
      {
        'data-type': 'emoji',
        'data-name': undefined,
        'data-emoji': undefined,
      },
      [
        'img',
        {
          src: undefined,
          alt: undefined,
          style:
            'width: 1.25em; height: 1.25em; vertical-align: text-top',
          draggable: 'false',
          loading: 'lazy',
        },
      ],
    ]);

    expect(result).toEqual(
      {
        attrs: {
          'data-type': 'emoji',
        },
        children: [
          {
            attrs: {
              draggable: 'false',
              loading: 'lazy',
              style: 'width: 1.25em; height: 1.25em; vertical-align: text-top',
            },
            tag: 'img',
          },
        ],
        tag: 'span',
      },
    );
  });
});
