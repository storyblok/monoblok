import { MARK_RENDER_MAP, NODE_RENDER_MAP } from './render-map.generated';
import type { PMMark, PMNode, TiptapComponentName } from './types.generated';
import { SELF_CLOSING_TAGS } from '../utils';
import type { HtmlTag, StoryblokRichTextComponentMap } from './types';

/**
 * Resolves a component from the provided components map based on the type.
 * @param type - The type of the component to resolve.
 * @param components - The components map to search in.
 * @returns The resolved component or undefined if not found.
 * @example
 * const components = {
 *   'heading': MyCustomHeading,
 * };
 * const resolvedComponent = resolveComponent('heading', components);
 * console.log(resolvedComponent); // Output: MyCustomHeading
 */
export function resolveComponent<
  K extends TiptapComponentName,
  TComponent,
  ExtraProps extends Record<string, unknown> = Record<string, unknown>,
>(
  type: K,
  components?: StoryblokRichTextComponentMap<TComponent, ExtraProps>,
): StoryblokRichTextComponentMap<TComponent, ExtraProps>[K] | undefined {
  return components?.[type];
}

/**
 * Resolves the HTML tag for a given Richtext node or mark.
 * @param node - The Richtext node or mark to resolve the tag for.
 * @returns The resolved HTML tag as a string, or null if no tag could be resolved.
 * @example
 * const node = { type: 'paragraph', attrs: {} };
 * const tag = resolveTag(node);
 * console.log(tag); // Output: "p"
 */
export function resolveTag(node: PMNode | PMMark): HtmlTag | null {
  const type = node.type;

  const entry
    = NODE_RENDER_MAP[type as keyof typeof NODE_RENDER_MAP]
      ?? MARK_RENDER_MAP[type as keyof typeof MARK_RENDER_MAP];

  if (!entry) {
    return null;
  }

  if ('resolve' in entry && typeof entry.resolve === 'function') {
    return entry.resolve(node.attrs as Parameters<typeof entry.resolve>[0]) as HtmlTag;
  }

  if ('tag' in entry && typeof entry.tag === 'string') {
    return entry.tag as HtmlTag;
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
export function isSelfClosing(tag: HtmlTag | string): boolean {
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
export function getStaticChildren(node: PMNode) {
  const renderMap = NODE_RENDER_MAP[node.type as keyof typeof NODE_RENDER_MAP];
  const staticChildren = renderMap && 'children' in renderMap ? renderMap.children : null;
  return staticChildren;
}
