import type { DOMOutputSpec } from 'prosemirror-model';
import type { AttrValue, RenderSpec } from '../types';
import { stringToStyle, styleToString } from '../style';

/** DOM spec in array form: [tag, attrs?, ...children] */
type ArrayDOMSpec = readonly [string, ...unknown[]];

/** DOM object spec with dom and optional contentDOM */
interface DOMObjectSpec {
  dom: Node;
  contentDOM?: HTMLElement;
}

/** Attribute object in a DOM spec */
type AttrsObject = Record<string, AttrValue>;

// Custom DOM specs for nodes that need special handling (e.g. table)
const CUSTOM_SPECS: Record<string, ArrayDOMSpec> = {
  table: ['table', ['tbody', 0]],
};

/** Parses a ProseMirror DOMOutputSpec into a RenderSpec. */
export function parseDOMSpec(spec: DOMOutputSpec): RenderSpec | null {
  // string
  if (typeof spec === 'string') {
    return { tag: spec };
  }
  // custom override
  if (isArraySpec(spec)) {
    const custom = CUSTOM_SPECS[spec[0]];
    if (custom) {
      spec = custom;
    }
  }
  // { dom, contentDOM }
  if (isDOMObjectSpec(spec)) {
    return {
      tag: spec.dom.nodeName.toLowerCase(),
      content: Boolean(spec.contentDOM),
    };
  }

  // Array spec
  if (isArraySpec(spec)) {
    return parseArraySpec(spec);
  }
  return null;
}

/** Parses an array-form DOM spec into a RenderSpec. */
function parseArraySpec(spec: ArrayDOMSpec): RenderSpec {
  const [tag, maybeAttrs, ...rest] = spec;
  let attrs: AttrsObject | undefined;
  let children: unknown[];

  if (isAttrsObject(maybeAttrs)) {
    attrs = maybeAttrs;
    children = rest;
  }
  else {
    children = maybeAttrs !== undefined ? [maybeAttrs, ...rest] : rest;
  }

  const parsedChildren: RenderSpec[] = [];
  let content = false;

  for (const child of children) {
    if (child === 0) {
      content = true;
      continue;
    }

    if (isArraySpec(child)) {
      parsedChildren.push(parseArraySpec(child));
    }
  }

  const filteredAttrs = attrs ? filterNullAttrs(attrs) : undefined;

  const result: RenderSpec = {
    tag,
    ...(filteredAttrs && Object.keys(filteredAttrs).length > 0 ? { attrs: filteredAttrs } : {}),
    ...(content ? { content: true } : {}),
    ...(parsedChildren.length > 0 ? { children: parsedChildren } : {}),
  };

  return result;
}

/** Filters out null and undefined attribute values. */
function filterNullAttrs(
  attrs: AttrsObject,
): Record<string, AttrValue> {
  const result: Record<string, AttrValue> = {};

  for (const key of Object.keys(attrs)) {
    const value = attrs[key];

    // First filter invalid values
    if (!isValidAttrValue(value)) {
      continue;
    }

    // Special handling for style
    if (key === 'style' && typeof value === 'string') {
      const styleObj = stringToStyle(value);

      const filteredStyle: Record<string, AttrValue> = {};

      for (const styleKey of Object.keys(styleObj)) {
        const styleValue = styleObj[styleKey];

        if (isValidAttrValue(styleValue)) {
          filteredStyle[styleKey] = styleValue;
        }
      }

      if (Object.keys(filteredStyle).length) {
        result[key] = styleToString(filteredStyle);
      }

      continue;
    }

    result[key] = value;
  }

  return result;
}

/** Type guard for attribute objects. */
function isAttrsObject(value: unknown): value is AttrsObject {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}
function isValidAttrValue(
  value: AttrValue,
): value is string | number | boolean {
  return (
    value !== null
    && value !== undefined
    && value !== 'null'
    && value !== 'undefined'
  );
}
/** Type guard for array-form DOM specs. */
function isArraySpec(value: unknown): value is ArrayDOMSpec {
  return Array.isArray(value) && typeof value[0] === 'string';
}

/** Type guard for DOM object specs. */
function isDOMObjectSpec(value: unknown): value is DOMObjectSpec {
  return (
    typeof value === 'object'
    && value !== null
    && 'dom' in value
  );
}
