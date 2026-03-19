import type { ParsedDOMSpec } from './types';

/**
 * Parses a ProseMirror DOMOutputSpec into a structured `{ tag, attrs, hasHole, contents }` object.
 *
 * ProseMirror's `toDOM` usually returns formats like:
 * - "p"
 * - ["div", { class: "custom" }, 0]
 * - ["code", ["span", 0]]
 */
export function parseDOMSpec(spec: any): ParsedDOMSpec | null {
  if (typeof spec === 'string') {
    return { tag: spec, attrs: {}, hasHole: false, children: [] };
  }

  // Handle raw HTMLElement nodes created by Tiptap extensions (e.g. Emoji)
  if (spec && typeof spec === 'object' && spec.nodeType === 1) {
    const element = spec as HTMLElement;
    const attrs: Record<string, string> = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attrs[attr.name] = attr.value;
    }
    return { tag: element.tagName.toLowerCase(), attrs, hasHole: false, children: [] };
  }

  if (Array.isArray(spec)) {
    const tag = spec[0];
    let attrs: Record<string, string> = {};
    let contentIdx = 1;

    // Check if the second element is an attributes object
    if (
      spec.length > 1
      && typeof spec[1] === 'object'
      && spec[1] !== null
      && !Array.isArray(spec[1])
      && !spec[1]?.nodeType
      && typeof spec[1] !== 'number'
    ) {
      attrs = spec[1];
      contentIdx = 2;
    }

    let hasHole = false;
    const children: Array<ParsedDOMSpec | string | { hole: true }> = [];

    for (let i = contentIdx; i < spec.length; i++) {
      const childSpec = spec[i];
      if (childSpec === 0) {
        hasHole = true;
        children.push({ hole: true });
      }
      else if (typeof childSpec === 'string') {
        children.push(childSpec);
      }
      else if (Array.isArray(childSpec)) {
        const parsedChild = parseDOMSpec(childSpec);
        if (parsedChild) {
          if (parsedChild.hasHole) {
            hasHole = true;
          }
          children.push(parsedChild);
        }
      }
    }

    return { tag, attrs, hasHole, children };
  }

  return null;
}
