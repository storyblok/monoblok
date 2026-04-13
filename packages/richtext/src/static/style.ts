import type { TiptapComponentName } from './types.generated';

type StyleMap = Partial<{
  [K in TiptapComponentName]: Record<string, string>;
}>;

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

type AttrMap = Record<string, string>;

const DEFAULT_ATTR_MAP: AttrMap = {
  fallbackImage: 'src',
  level: 'data-level',
  meta_data: 'data-meta_data',
  body: 'data-body',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
};

/**
 * Process Tiptap attributes into HTML attributes and inline styles.
 * Applies internal style mappings and allows extending or overriding
 * default attribute mappings via `extendAttrMap`.
 *
 * @param type - {@link TiptapComponentName}
 * @param attrs - Attributes from the node/mark
 * @param extendAttrMap - {@link AttrMap} Additional attribute mappings (overrides defaults)
 * @returns Processed attributes with optional `style` object
 */
export function processAttrs(
  type: TiptapComponentName,
  attrs: Record<string, any> = {},
  extendAttrMap: AttrMap = {},
) {
  const style: Record<string, any> = {};
  const rest: Record<string, any> = {};

  const styleMap = STYLE_MAP[type] || {};
  const attrMap = { ...DEFAULT_ATTR_MAP, ...extendAttrMap }; // user overrides

  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) {
      continue;
    }

    // STYLE MAP
    if (key in styleMap) {
      const cssProp = styleMap[key as keyof typeof styleMap];
      if (Array.isArray(value)) {
        style[cssProp] = value[0] != null ? `${value[0]}px` : undefined;
      }
      else {
        style[cssProp] = value;
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

  return {
    ...rest,
    ...(Object.keys(style).length && { style }),
  };
}
export function styleToString(style: Record<string, any>) {
  return Object.entries(style)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}: ${v}`)
    .join('; ');
}
export function stringToStyle(style: string): Record<string, string> {
  return style
    .split(';')
    .map(rule => rule.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, rule) => {
      const [key, value] = rule.split(':').map(s => s.trim());
      if (key && value) {
        acc[kebabToCamel(key)] = value;
      }
      return acc;
    }, {});
}

function kebabToCamel(str: string) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
