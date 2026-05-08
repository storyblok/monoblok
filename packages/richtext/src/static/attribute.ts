import { NODE_RENDER_MAP } from './render-map.generated';
import { isValidStyleValue, stringToStyle } from './style';
import type { AttrValue, SbRichTextElement } from './types';

type StyleMap = Partial<{
  [K in SbRichTextElement]: Record<string, string>;
}>;
export type AttrMap = Record<string, string>;

/**
 * Maps Tiptap attribute names to CSS property names for specific element types.
 */
const STYLE_MAP: StyleMap = {
  highlight: {
    color: 'backgroundColor',
  },
  textStyle: {
    color: 'color',
  },
  paragraph: {
    textAlign: 'textAlign',
  },
  heading: {
    textAlign: 'textAlign',
  },
  tableCell: {
    backgroundColor: 'backgroundColor',
    colwidth: 'width',
  },
  tableHeader: {
    colwidth: 'width',
  },
};

/**
 * Maps Tiptap attribute names to HTML attribute names.
 */
const DEFAULT_ATTR_MAP: AttrMap = {
  fallbackImage: 'src',
  body: 'data-body',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  name: 'data-name',
  emoji: 'data-emoji',
};

/**
 * Attributes that should be excluded from the output.
 */
export const EXCLUDED_ATTRS = new Set(['level', 'linktype', 'uuid', 'anchor', 'meta_data', 'copyright', 'source']);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolves the href for Storyblok link types (story, email).
 * @returns The resolved href, or undefined if no special handling is needed.
 */
function resolveStoryblokLinkHref(attrs: Record<string, unknown>): string | undefined {
  const { linktype, href, anchor } = attrs;

  if (linktype === 'story') {
    const base = typeof href === 'string' ? href : '';
    const hash = typeof anchor === 'string' && anchor ? `#${anchor}` : '';
    return `${base}${hash}`;
  }

  if (linktype === 'email' && typeof href === 'string') {
    const email = href.replace(/^mailto:/, '');
    return `mailto:${email}`;
  }

  return undefined;
}

/**
 * Extracts static attributes and styles from the render map for a given element type.
 */
function getStaticAttrsFromRenderMap(
  type: SbRichTextElement,
): { staticAttrs: Record<string, unknown>; staticStyle: Record<string, AttrValue> } {
  const staticStyle: Record<string, AttrValue> = {};
  let staticAttrs: Record<string, unknown> = {};

  if (!(type in NODE_RENDER_MAP)) {
    return { staticAttrs, staticStyle };
  }

  const renderMap = NODE_RENDER_MAP[type as keyof typeof NODE_RENDER_MAP];
  if (!renderMap || !('attrs' in renderMap)) {
    return { staticAttrs, staticStyle };
  }

  const renderAttrs = renderMap.attrs || {};
  const rawStyle = 'style' in renderAttrs && typeof renderAttrs.style === 'string'
    ? renderAttrs.style
    : '';

  const { style: _style, ...rest } = renderAttrs as Record<string, unknown>;
  staticAttrs = rest;

  if (rawStyle) {
    Object.assign(staticStyle, stringToStyle(rawStyle));
  }

  return { staticAttrs, staticStyle };
}

/**
 * Converts an attribute value to a CSS value based on the style map.
 * Handles arrays (e.g., colwidth) and primitive values.
 */
function convertToStyleValue(value: unknown): AttrValue | undefined {
  if (Array.isArray(value)) {
    return value[0] != null ? `${value[0]}px` : undefined;
  }

  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  return String(value);
}

/**
 * Processes a single attribute and adds it to either the style or rest object.
 */
function processAttribute(
  key: string,
  value: unknown,
  type: SbRichTextElement,
  styleMap: Record<string, string>,
  attrMap: AttrMap,
  style: Record<string, AttrValue>,
  rest: Record<string, unknown>,
): void {
  if (!isValidStyleValue(value) || EXCLUDED_ATTRS.has(key)) {
    return;
  }

  // Handle style-mapped attributes
  if (key in styleMap) {
    const cssProp = styleMap[key]!;
    const cssValue = convertToStyleValue(value);
    if (cssValue !== undefined && isValidStyleValue(cssValue)) {
      style[cssProp] = cssValue;
    }
    return;
  }

  const attrName = attrMap[key] ?? key;

  // Handle custom attributes for links (spread them as individual attributes)
  if (attrName === 'custom' && type === 'link' && typeof value === 'object' && value !== null) {
    for (const [customKey, customValue] of Object.entries(value)) {
      rest[customKey] = String(customValue);
    }
    return;
  }

  // Handle other object values (stringify them)
  if (typeof value === 'object' && value !== null) {
    rest[attrName] = JSON.stringify(value);
    return;
  }

  // Default: pass through as-is
  rest[attrName] = value;
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Process Tiptap attributes into HTML attributes and inline styles.
 * Applies internal style mappings and allows extending or overriding
 * default attribute mappings via `extendAttrMap`.
 *
 * @param type - {@link SbRichTextElement}
 * @param attrs - Attributes from the node/mark
 * @param extendAttrMap - {@link AttrMap} Additional attribute mappings (overrides defaults)
 * @returns Processed attributes with optional `style` object
 */
export function processAttrs(
  type: SbRichTextElement,
  attrs: Record<string, unknown> = {},
  extendAttrMap: AttrMap = {},
): Record<string, unknown> {
  const { staticAttrs, staticStyle } = getStaticAttrsFromRenderMap(type);
  const style: Record<string, AttrValue> = { ...staticStyle };
  const rest: Record<string, unknown> = {};

  const styleMap = STYLE_MAP[type] || {};
  const attrMap = { ...DEFAULT_ATTR_MAP, ...extendAttrMap };
  const mergedAttrs = { ...attrs, ...staticAttrs };

  for (const [key, value] of Object.entries(mergedAttrs)) {
    processAttribute(key, value, type, styleMap, attrMap, style, rest);
  }

  // Special handling for Storyblok links
  if (type === 'link') {
    const linkHref = resolveStoryblokLinkHref(attrs);
    if (linkHref !== undefined) {
      rest.href = linkHref;
    }
  }

  return {
    ...rest,
    ...(Object.keys(style).length > 0 && { style }),
  };
}

/**
 * Escapes special HTML characters in attribute values.
 */
export const escapeAttr = (value: unknown): string =>
  String(value).replace(/[&"'<>]/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '"': return '&quot;';
      case '\'': return '&#39;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      default: return char;
    }
  });
