import type { DOMOutputSpec } from 'prosemirror-model';

export interface RenderSpec {
  tag: string;
  attrs?: Record<string, any>;
  content?: boolean;
  children?: RenderSpec[];
  resolve?: (attrs: unknown) => string;
};
export function parseDOMSpec(spec: DOMOutputSpec): RenderSpec | null {
  // string
  if (typeof spec === 'string') {
    return { tag: spec };
  }

  // { dom, contentDOM }
  if (isDOMObject(spec)) {
    return {
      tag: spec.dom.nodeName.toLowerCase(),
      content: !!spec.contentDOM,
    };
  }

  // Array spec
  if (Array.isArray(spec)) {
    return parseArraySpec(spec);
  }
  return null;
}

function parseArraySpec(spec: readonly any[]): RenderSpec {
  try {
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
  catch (err) {
    console.error('parseArraySpec error:', err);
    console.error('spec causing error:', spec);
    throw err;
  }
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
