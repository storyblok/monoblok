import type { DOMOutputSpec } from 'prosemirror-model';
import type { RenderSpec } from '../types';

// Custom DOM specs for nodes that need special handling (e.g. table)
const CUSTOM_SPECS: Record<string, DOMOutputSpec> = {
  table: ['table', ['tbody', 0]],
} as const;

export function parseDOMSpec(spec: DOMOutputSpec): RenderSpec | null {
  // string
  if (typeof spec === 'string') {
    return { tag: spec };
  }
  // custom override
  if (Array.isArray(spec) && typeof spec[0] === 'string') {
    const custom = CUSTOM_SPECS[spec[0]];
    if (custom) {
      spec = custom;
    }
  }
  // { dom, contentDOM }
  if (isDOMObject(spec)) {
    return {
      tag: spec.dom.nodeName.toLowerCase(),
      content: Boolean(spec.contentDOM),
    };
  }

  // Array spec
  if (Array.isArray(spec)) {
    return parseArraySpec(spec);
  }
  return null;
}

function parseArraySpec(spec: readonly any[]): RenderSpec {
  const [tag, maybeAttrs, ...rest] = spec;
  let attrs: Record<string, any> | undefined;
  let children: any[];

  if (isAttrs(maybeAttrs)) {
    attrs = maybeAttrs;
    children = rest;
  }
  else {
    children = [maybeAttrs, ...rest];
  }

  const parsedChildren: RenderSpec[] = [];
  let content = false;

  for (const child of children) {
    if (child === 0) {
      content = true;
      continue;
    }

    if (Array.isArray(child)) {
      const parsed = parseArraySpec(child);
      if (parsed) {
        parsedChildren.push(parsed);
      }
    }
  }

  const result: RenderSpec = {
    tag,
    ...(attrs && Object.keys(attrs).length ? { attrs } : {}),
    ...(content ? { content: true } : {}),
    ...(parsedChildren.length ? { children: parsedChildren } : {}),
  };

  return result;
}

function isAttrs(value: unknown): value is Record<string, any> {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

function isDOMObject(
  value: unknown,
): value is { dom: Node; contentDOM?: HTMLElement } {
  return (
    typeof value === 'object'
    && value !== null
    && 'dom' in value
  );
}
