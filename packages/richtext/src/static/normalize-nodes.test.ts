import { describe, expect, it } from 'vitest';
import { normalizeNodes } from './normalize-nodes';
import type { RichTextDoc, RichTextNode } from '../generated/overlay/types.gen';
import { customRendererFixture } from '../test-utils';

describe('normalizeNodes', () => {
  it('return empty array for null or undefined input', () => {
    expect(normalizeNodes(null)).toEqual([]);
    expect(normalizeNodes(undefined)).toEqual([]);
  });
  it('returns empty array for empty array input', () => {
    expect(normalizeNodes([])).toEqual([]);
  });
  it('wraps single node in array', () => {
    const node: RichTextNode = { type: 'paragraph' };
    expect(normalizeNodes(node)).toEqual([node]);
  });
  it('unwraps doc node to content array', () => {
    const content: RichTextNode[] = [{ type: 'paragraph' }];
    const docNode: RichTextDoc = { type: 'doc', content };
    expect(normalizeNodes(docNode)).toEqual(content);
  });
  const node_and_mark = customRendererFixture.node_and_mark;
  it('unwraps doc node to content array and add keys', () => {
    const normalized = normalizeNodes(node_and_mark.input, true);
    normalized.forEach((node) => {
      expect(node).toHaveProperty('_key');
      expect(typeof node?._key).toBe('string');
      expect(node._key).toContain(node.type);
    });
  });
});
