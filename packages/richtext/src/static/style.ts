import type { AttrValue } from './generate/parse-dom-spec';
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
  attrs: Record<string, unknown> = {},
  extendAttrMap: AttrMap = {},
) {
  const style: Record<string, AttrValue> = {};
  const rest: Record<string, unknown> = {};

  const styleMap = STYLE_MAP[type] || {};
  const attrMap = { ...DEFAULT_ATTR_MAP, ...extendAttrMap }; // user overrides
  for (const [key, value] of Object.entries(attrs)) {
    if (!isValidStyleValue(value)) {
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

  return {
    ...rest,
    ...(Object.keys(style).length && { style }),
  };
}
export function styleToString(style: Record<string, AttrValue>) {
  return Object.entries(style)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
    .join('; ');
}
export function stringToStyle(style: string): Record<string, string> {
  return style
    .split(';')
    .map(rule => rule.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, rule) => {
      const colonIdx = rule.indexOf(':');

      // ignore invalid declarations like "color" or ": red"
      if (colonIdx === -1) {
        return acc;
      }

      const key = rule.slice(0, colonIdx).trim();
      const value = rule.slice(colonIdx + 1).trim();

      if (!key || !value) {
        return acc;
      }

      acc[kebabToCamel(key)] = value;
      return acc;
    }, {});
}

function kebabToCamel(str: string) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
function camelToKebab(str: string) {
  return str.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
}
function isValidStyleValue(value: unknown) {
  return value !== null && value !== undefined && value !== '';
}
