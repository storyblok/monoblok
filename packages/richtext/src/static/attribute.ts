import { NODE_RENDER_MAP } from './render-map.generated';
import { isValidStyleValue, stringToStyle } from './style';
import type { AttrValue, SbRichTextElement } from './types';

type StyleMap = Partial<{
  [K in SbRichTextElement]: Record<string, string>;
}>;
export type AttrMap = Record<string, string>;

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

const DEFAULT_ATTR_MAP: AttrMap = {
  fallbackImage: 'src',
  body: 'data-body',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
};

export const EXCLUDED_ATTRS = new Set(['level', 'linktype', 'uuid', 'custom', 'anchor', 'meta_data', 'copyright', 'source']);

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
) {
  const style: Record<string, AttrValue> = {};
  const rest: Record<string, unknown> = {};
  let staticAttrs: Record<string, unknown> = {};

  if (type in NODE_RENDER_MAP) {
    const renderMap
    = NODE_RENDER_MAP[
      type as keyof typeof NODE_RENDER_MAP
    ];
    if (renderMap && 'attrs' in renderMap) {
      const attrs = renderMap.attrs || {};

      const rawStyle
      = 'style' in attrs && typeof attrs.style === 'string'
        ? attrs.style
        : '';
      const { style: _style, ...rest } = attrs as Record<string, unknown>;

      staticAttrs = rest;
      if (rawStyle) {
        Object.assign(style, stringToStyle(rawStyle));
      }
    }
  }
  const styleMap = STYLE_MAP[type] || {};
  const attrMap = { ...DEFAULT_ATTR_MAP, ...extendAttrMap }; // user overrides
  for (const [key, value] of Object.entries({ ...attrs, ...staticAttrs })) {
    if (!isValidStyleValue(value) || EXCLUDED_ATTRS.has(key)) {
      continue;
    }
    // STYLE MAP
    if (key in styleMap) {
      const cssProp = styleMap[key]!;
      if (Array.isArray(value)) {
        const cssValue = value[0] != null ? `${value[0]}px` : undefined;
        if (cssValue && isValidStyleValue(cssValue)) {
          style[cssProp] = cssValue;
        }
      }
      else {
        const cssValue = typeof value === 'number' || typeof value === 'string'
          ? value
          : String(value);

        style[cssProp] = cssValue;
      }
      continue;
    }

    // Resolve attribute name first
    const attrName = attrMap[key] ?? key;

    // stringify objects
    if (typeof value === 'object' && value !== null) {
      rest[attrName] = JSON.stringify(value);
      continue;
    }

    // DEFAULT PASS THROUGH
    rest[attrName] = value;
  }
  // Special handling for Storyblok links
  if (type === 'link' && attrs.linktype === 'story') {
    rest.href = `${attrs.href ?? ''}${attrs.anchor ? `#${attrs.anchor}` : ''}`;
  }
  if (type === 'link'
    && attrs.linktype === 'email'
    && typeof attrs.href === 'string') {
    rest.href = `mailto:${attrs.href.replace('mailto:', '') ?? ''}`;
  }

  return {
    ...rest,
    ...(Object.keys(style).length && { style }),
  };
}
export const escapeAttr = (value: unknown) =>
  String(value).replace(/[&"'<>]/g, (s) => {
    switch (s) {
      case '&': return '&amp;';
      case '"': return '&quot;';
      case '\'': return '&#39;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      default: return s;
    }
  });
