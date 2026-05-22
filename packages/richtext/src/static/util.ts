import { MARK_RENDER_MAP, NODE_RENDER_MAP } from './render-map.generated';
import type { SbRichTextMark, SbRichTextNode } from './types.generated';
import { SELF_CLOSING_TAGS } from '../utils';
/**
 * Resolves the HTML tag for a given Richtext node or mark.
 * @param node - The Richtext node or mark to resolve the tag for.
 * @returns The resolved HTML tag as a string, or null if no tag could be resolved.
 * @example
 * const node = { type: 'paragraph', attrs: {} };
 * const tag = resolveTag(node);
 * console.log(tag); // Output: "p"
 */
export function resolveTag(node: SbRichTextNode | SbRichTextMark): string | null {
  const type = node.type;

  const entry
    = NODE_RENDER_MAP[type as keyof typeof NODE_RENDER_MAP]
      ?? MARK_RENDER_MAP[type as keyof typeof MARK_RENDER_MAP];

  if (!entry) {
    return null;
  }

  if ('resolve' in entry && typeof entry.resolve === 'function') {
    return entry.resolve(node.attrs as Parameters<typeof entry.resolve>[0]);
  }

  if ('tag' in entry && typeof entry.tag === 'string') {
    return entry.tag;
  }

  return null;
}

/**
 * Checks if a given HTML tag is self-closing.
 * @param tag - The HTML tag to check.
 * @returns True if the tag is self-closing, false otherwise.
 * @example
 * console.log(isSelfClosing('img')); // Output: true
 * console.log(isSelfClosing('div')); // Output: false
 *
 */
export function isSelfClosing(tag: string): boolean {
  return SELF_CLOSING_TAGS.includes(tag);
}

/**
 * Returns static child definitions for a given RichText node.
 *
 * @param node - The RichText node
 * @returns Static child render specs, or null if none exist
 *
 * @example
 * const children = getStaticChildren({ type: 'table', attrs: {} });
 * // [{ tag: 'tbody', content: true }]
 */
export function getStaticChildren(node: SbRichTextNode) {
  const renderMap = NODE_RENDER_MAP[node.type as keyof typeof NODE_RENDER_MAP];
  const staticChildren = renderMap && 'children' in renderMap ? renderMap.children : null;
  return staticChildren;
}
/**
 * Normalizes a Storyblok Richtext input into an array of nodes.
 * Supports single nodes, doc nodes, arrays, and nullable values.
 */
export function normalizeNodes(
  input: SbRichTextNode | SbRichTextNode[] | null | undefined,
): SbRichTextNode[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input;
  }

  return input.type === 'doc'
    ? input.content || []
    : [input];
}
