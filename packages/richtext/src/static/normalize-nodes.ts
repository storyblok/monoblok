import { createKeyGenerator } from '../utils';
import type { RichTextDoc, RichTextNode } from '../generated/overlay/types.gen';
import type { StoryblokRichTextInput, StoryblokRichTextMarkWithKey, StoryblokRichTextNodeWithKey } from './types';

/**
 * Normalizes a Storyblok Richtext input into an array of nodes.
 * Supports single nodes, doc nodes, arrays, and nullable values.
 *
 * When called without `includeKeys` (or with `false`), returns a plain
 * `RichTextNode[]` — the lean generated type with no renderer metadata.
 *
 * When called with `includeKeys: true`, returns `RichTextNodeWithKey[]` with
 * `_key` fields added (recursively on content and marks) for React/Vue/Angular
 * key-based rendering.
 */
export function normalizeNodes(
  input: StoryblokRichTextInput,
  includeKeys: true,
): StoryblokRichTextNodeWithKey[];
export function normalizeNodes(
  input: StoryblokRichTextInput,
  includeKeys?: false,
): RichTextNode[];
export function normalizeNodes(
  input: StoryblokRichTextInput,
  includeKeys = false,
): RichTextNode[] | StoryblokRichTextNodeWithKey[] {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    if (!includeKeys) {
      return input;
    }
    const keyGen = createKeyGenerator();
    return addKeys(input, keyGen);
  }

  const nodes: RichTextNode[]
    = input.type === 'doc'
      ? (input as RichTextDoc).content || []
      : [input as RichTextNode];

  if (!includeKeys) {
    return nodes;
  }
  const keyGen = createKeyGenerator();
  return addKeys(nodes, keyGen);
}

function addKeys(
  nodes: RichTextNode[],
  generateKey: (prefix: string) => string,
): StoryblokRichTextNodeWithKey[] {
  return nodes.map((node) => {
    const withKey = {
      ...node,
      _key: generateKey(node.type),
    } as unknown as StoryblokRichTextNodeWithKey;

    // Only spread marks when the node type carries them at runtime
    if ('marks' in node && Array.isArray(node.marks)) {
      (withKey as unknown as Record<string, unknown>).marks = node.marks.map((mark): StoryblokRichTextMarkWithKey => ({
        ...mark,
        _key: generateKey(mark.type),
      }));
    }

    // Recurse into content only when it exists at runtime
    if ('content' in node && Array.isArray(node.content)) {
      (withKey as unknown as Record<string, unknown>).content = addKeys(
        node.content as RichTextNode[],
        generateKey,
      );
    }

    return withKey;
  });
}
