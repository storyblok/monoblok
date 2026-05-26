import { describe, expect, it } from 'vitest';
import {
  areLinkMarksEqual,
  getInnerMarks,
  getTextNodeLinkMark,
  groupLinkNodes,
  isTableHeaderRow,
  splitTableRows,
} from './node-helpers';
import type { SbRichTextNode } from './types.generated';
import { linkMark, text as textNode } from '../test-utils/helpers';

// ============================================================================
// getTextNodeLinkMark
// ============================================================================

describe('getTextNodeLinkMark', () => {
  it('returns null for non-text nodes', () => {
    const node: SbRichTextNode = { type: 'paragraph', content: [] };
    expect(getTextNodeLinkMark(node)).toBeNull();
  });

  it('returns null for text node without marks', () => {
    const node = textNode('hello');
    expect(getTextNodeLinkMark(node)).toBeNull();
  });

  it('returns null for text node with non-link marks', () => {
    const node = textNode('hello', [{ type: 'bold' }]);
    expect(getTextNodeLinkMark(node)).toBeNull();
  });

  it('returns link mark when present', () => {
    const mark = linkMark('/test');
    const node = textNode('hello', [mark]);
    expect(getTextNodeLinkMark(node)).toEqual(mark);
  });

  it('returns link mark even with other marks present', () => {
    const mark = linkMark('/test');
    const node = textNode('hello', [{ type: 'bold' }, mark, { type: 'italic' }]);
    expect(getTextNodeLinkMark(node)).toEqual(mark);
  });
});

// ============================================================================
// areLinkMarksEqual
// ============================================================================

describe('areLinkMarksEqual', () => {
  it('returns false when first mark is null', () => {
    expect(areLinkMarksEqual(null, linkMark('/a'))).toBe(false);
  });

  it('returns false when second mark is null', () => {
    expect(areLinkMarksEqual(linkMark('/a'), null)).toBe(false);
  });

  it('returns false when both marks are null', () => {
    expect(areLinkMarksEqual(null, null)).toBe(false);
  });

  it('returns true for identical marks', () => {
    const mark = linkMark('/test', { target: '_blank' });
    expect(areLinkMarksEqual(mark, { ...mark })).toBe(true);
  });

  it('returns true for marks with same href', () => {
    expect(areLinkMarksEqual(linkMark('/a'), linkMark('/a'))).toBe(true);
  });

  it('returns false for marks with different href', () => {
    expect(areLinkMarksEqual(linkMark('/a'), linkMark('/b'))).toBe(false);
  });

  it('returns false for marks with different target', () => {
    expect(areLinkMarksEqual(
      linkMark('/a', { target: '_blank' }),
      linkMark('/a', { target: '_self' }),
    )).toBe(false);
  });

  it('returns false for marks with different linktype', () => {
    expect(areLinkMarksEqual(
      linkMark('/a', { linktype: 'story' }),
      linkMark('/a', { linktype: 'url' }),
    )).toBe(false);
  });

  it('returns false for marks with different anchor', () => {
    expect(areLinkMarksEqual(
      linkMark('/a', { anchor: 'section1' }),
      linkMark('/a', { anchor: 'section2' }),
    )).toBe(false);
  });

  it('returns false for marks with different uuid', () => {
    expect(areLinkMarksEqual(
      linkMark('/a', { uuid: 'uuid-1' }),
      linkMark('/a', { uuid: 'uuid-2' }),
    )).toBe(false);
  });

  it('returns true for marks with same custom attributes', () => {
    expect(areLinkMarksEqual(
      linkMark('/a', { custom: { title: 'hello' } }),
      linkMark('/a', { custom: { title: 'hello' } }),
    )).toBe(true);
  });

  it('returns false for marks with different custom attributes', () => {
    expect(areLinkMarksEqual(
      linkMark('/a', { custom: { title: 'hello' } }),
      linkMark('/a', { custom: { title: 'world' } }),
    )).toBe(false);
  });

  it('returns false when one mark has custom and other does not', () => {
    expect(areLinkMarksEqual(
      linkMark('/a', { custom: { title: 'hello' } }),
      linkMark('/a'),
    )).toBe(false);
  });

  it('returns true for marks with nested custom attributes', () => {
    expect(areLinkMarksEqual(
      linkMark('/a', { custom: { data: { nested: 'value' } } }),
      linkMark('/a', { custom: { data: { nested: 'value' } } }),
    )).toBe(true);
  });

  it('returns false for marks with different nested custom attributes', () => {
    expect(areLinkMarksEqual(
      linkMark('/a', { custom: { data: { nested: 'value1' } } }),
      linkMark('/a', { custom: { data: { nested: 'value2' } } }),
    )).toBe(false);
  });
});

// ============================================================================
// getInnerMarks
// ============================================================================

describe('getInnerMarks', () => {
  it('returns empty array for non-text nodes', () => {
    const node: SbRichTextNode = { type: 'paragraph', content: [] };
    expect(getInnerMarks(node)).toEqual([]);
  });

  it('returns empty array for text node without marks', () => {
    const node = textNode('hello');
    expect(getInnerMarks(node)).toEqual([]);
  });

  it('returns empty array when only link mark present', () => {
    const node = textNode('hello', [linkMark('/test')]);
    expect(getInnerMarks(node)).toEqual([]);
  });

  it('returns non-link marks', () => {
    const boldMark = { type: 'bold' };
    const italicMark = { type: 'italic' };
    const node = textNode('hello', [{
      type: 'bold',
    }, linkMark('/test'), {
      type: 'italic',
    }]);
    expect(getInnerMarks(node)).toEqual([boldMark, italicMark]);
  });
});

// ============================================================================
// groupLinkNodes
// ============================================================================

describe('groupLinkNodes', () => {
  it('returns empty array for empty children', () => {
    expect(groupLinkNodes([])).toEqual([]);
  });

  it('groups single non-linked text node', () => {
    const node = textNode('hello');
    const result = groupLinkNodes([node]);
    expect(result).toEqual([{ _key: 'group-node-0', nodes: [node], linkMark: null }]);
  });

  it('groups single linked text node', () => {
    const mark = linkMark('/test');
    const node = textNode('hello', [mark]);
    const result = groupLinkNodes([node]);
    expect(result).toEqual([{ _key: 'group-link-0', nodes: [node], linkMark: mark }]);
  });

  it('merges adjacent text nodes with same link', () => {
    const mark = linkMark('/test');
    const node1 = textNode('hello ', [mark]);
    const node2 = textNode('world', [mark]);
    const result = groupLinkNodes([node1, node2]);
    expect(result).toEqual([{ _key: 'group-link-0', nodes: [node1, node2], linkMark: mark }]);
  });

  it('separates text nodes with different links', () => {
    const mark1 = linkMark('/a');
    const mark2 = linkMark('/b');
    const node1 = textNode('hello', [mark1]);
    const node2 = textNode('world', [mark2]);
    const result = groupLinkNodes([node1, node2]);
    expect(result).toEqual([
      { _key: 'group-link-0', nodes: [node1], linkMark: mark1 },
      { _key: 'group-link-1', nodes: [node2], linkMark: mark2 },
    ]);
  });

  it('separates linked and non-linked text nodes', () => {
    const mark = linkMark('/test');
    const linkedNode = textNode('linked', [mark]);
    const plainNode = textNode('plain');
    const result = groupLinkNodes([linkedNode, plainNode]);
    expect(result).toEqual([
      { _key: 'group-link-0', nodes: [linkedNode], linkMark: mark },
      { _key: 'group-node-1', nodes: [plainNode], linkMark: null },
    ]);
  });

  it('handles non-text nodes', () => {
    const mark = linkMark('/test');
    const textNodeA: SbRichTextNode = textNode('before', [mark]);
    const brNode: SbRichTextNode = { type: 'hard_break' };
    const textNodeB: SbRichTextNode = textNode('after', [mark]);
    const result = groupLinkNodes([textNodeA, brNode, textNodeB]);
    expect(result).toEqual([
      { _key: 'group-link-0', nodes: [textNodeA], linkMark: mark },
      { _key: 'group-node-1', nodes: [brNode], linkMark: null },
      { _key: 'group-link-2', nodes: [textNodeB], linkMark: mark },
    ]);
  });

  it('separates nodes when custom attributes differ', () => {
    const mark1 = linkMark('/a', { custom: { title: 'google' } });
    const mark2 = linkMark('/a', { custom: { title: 'new' } });
    const node1 = textNode('A', [mark1]);
    const node2 = textNode('B', [mark2]);
    const result = groupLinkNodes([node1, node2]);
    expect(result).toEqual([
      { _key: 'group-link-0', nodes: [node1], linkMark: mark1 },
      { _key: 'group-link-1', nodes: [node2], linkMark: mark2 },
    ]);
  });
});

// ============================================================================
// isTableHeaderRow
// ============================================================================

describe('isTableHeaderRow', () => {
  it('returns false for row without content', () => {
    const row: SbRichTextNode = { type: 'tableRow' };
    expect(isTableHeaderRow(row)).toBe(false);
  });

  it('returns false for row with empty content', () => {
    const row: SbRichTextNode = { type: 'tableRow', content: [] };
    expect(isTableHeaderRow(row)).toBe(false);
  });

  it('returns false for row with tableCell', () => {
    const row: SbRichTextNode = {
      type: 'tableRow',
      content: [{ type: 'tableCell' }],
    };
    expect(isTableHeaderRow(row)).toBe(false);
  });

  it('returns true for row with only tableHeader cells', () => {
    const row: SbRichTextNode = {
      type: 'tableRow',
      content: [
        { type: 'tableHeader' },
        { type: 'tableHeader' },
      ],
    };
    expect(isTableHeaderRow(row)).toBe(true);
  });

  it('returns false for mixed row', () => {
    const row: SbRichTextNode = {
      type: 'tableRow',
      content: [
        { type: 'tableHeader' },
        { type: 'tableCell' },
      ],
    };
    expect(isTableHeaderRow(row)).toBe(false);
  });
});

// ============================================================================
// splitTableRows
// ============================================================================

describe('splitTableRows', () => {
  it('returns empty arrays for undefined rows', () => {
    expect(splitTableRows(undefined)).toEqual({ headerRows: [], bodyRows: [] });
  });

  it('returns empty arrays for empty rows', () => {
    expect(splitTableRows([])).toEqual({ headerRows: [], bodyRows: [] });
  });

  it('returns all rows as body when no header rows', () => {
    const rows: SbRichTextNode[] = [
      { type: 'tableRow', content: [{ type: 'tableCell' }] },
      { type: 'tableRow', content: [{ type: 'tableCell' }] },
    ];
    expect(splitTableRows(rows)).toEqual({ headerRows: [], bodyRows: rows });
  });

  it('returns all rows as header when all are header rows', () => {
    const rows: SbRichTextNode[] = [
      { type: 'tableRow', content: [{ type: 'tableHeader' }] },
      { type: 'tableRow', content: [{ type: 'tableHeader' }] },
    ];
    expect(splitTableRows(rows)).toEqual({ headerRows: rows, bodyRows: [] });
  });

  it('splits header and body rows correctly', () => {
    const headerRow: SbRichTextNode = { type: 'tableRow', content: [{ type: 'tableHeader' }] };
    const bodyRow1: SbRichTextNode = { type: 'tableRow', content: [{ type: 'tableCell' }] };
    const bodyRow2: SbRichTextNode = { type: 'tableRow', content: [{ type: 'tableCell' }] };
    const rows = [headerRow, bodyRow1, bodyRow2];
    expect(splitTableRows(rows)).toEqual({
      headerRows: [headerRow],
      bodyRows: [bodyRow1, bodyRow2],
    });
  });

  it('only considers contiguous header rows at start', () => {
    const headerRow1: SbRichTextNode = { type: 'tableRow', content: [{ type: 'tableHeader' }] };
    const bodyRow: SbRichTextNode = { type: 'tableRow', content: [{ type: 'tableCell' }] };
    const headerRow2: SbRichTextNode = { type: 'tableRow', content: [{ type: 'tableHeader' }] };
    const rows = [headerRow1, bodyRow, headerRow2];
    expect(splitTableRows(rows)).toEqual({
      headerRows: [headerRow1],
      bodyRows: [bodyRow, headerRow2],
    });
  });
});
