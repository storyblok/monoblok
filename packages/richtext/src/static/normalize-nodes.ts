import { createKeyGenerator } from '../utils';
import type { SbRichTextInput } from './types';
import type { SbRichTextNode } from './types.generated';

/**
 * Normalizes a Storyblok Richtext input into an array of nodes.
 * Supports single nodes, doc nodes, arrays, and nullable values.
 */
export function normalizeNodes(
  input: SbRichTextInput,
  includeKeys = false,
): SbRichTextNode[] {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    return input;
  }
  const nodes = input.type === 'doc' ? input.content || [] : [input];

  if (!includeKeys) {
    return nodes;
  }
  const keyGen = createKeyGenerator();

  return addKeys(nodes, keyGen);
}
function addKeys(
  nodes: SbRichTextNode[],
  generateKey: (prefix: string) => string,
): SbRichTextNode[] {
  return nodes.map(node => ({
    ...node,
    _key: generateKey(node.type),
    marks: node.marks?.map(mark => ({
      ...mark,
      _key: generateKey(mark.type),
    })),
    // Only re-attach `content` when the node actually has it. The root `doc`
    // node always carries `content`, while leaf and empty nodes legitimately
    // omit it, so we must not force `content: undefined` onto them.
    ...(node.content ? { content: addKeys(node.content, generateKey) } : {}),
  }));
}
