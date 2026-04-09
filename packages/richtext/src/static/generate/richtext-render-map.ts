import { type AnyExtension, getSchema } from '@tiptap/core';
import { defaultExtensions } from '../../extensions';

/**
 * Known dynamic resolvers (hand-written, minimal set)
 * These handle cases where toDOM depends on attrs
 */
const DYNAMIC_NODE_RESOLVERS: Record<string, string> = {
  heading: `(attrs: TiptapNodeAttributes['heading']) => \`h\${attrs?.level || 1}\``,
};
function parseDOMSpec(_dom: any) {
  return null;
}
/**
 * Safely create mock attrs using schema defaults
 */
function getMockAttrs(type: any) {
  const result: Record<string, any> = {};

  for (const [key, val] of Object.entries(type.attrs || {})) {
    const attr: any = val;
    result[key] = attr.default ?? null;
  }

  return result;
}

/**
 * Extract DOM spec from a node/mark
 */
function extractDOMSpec(type: any) {
  if (!type?.spec?.toDOM) {
    return null;
  }

  try {
    const mock = { type, attrs: getMockAttrs(type) };

    const dom = type.spec.toDOM(mock);
    const parsed = parseDOMSpec(dom);

    return parsed;
  }
  catch {
    return null;
  }
}

/**
 * Generate render map entries
 */
function generateRenderEntries(
  types: Record<string, any>,
  kind: 'node' | 'mark',
) {
  let out = '';

  for (const [name, type] of Object.entries(types)) {
    // Handle known dynamic nodes first (e.g. heading)
    if (kind === 'node' && DYNAMIC_NODE_RESOLVERS[name]) {
      out += `  ${name}: {
    resolve: ${DYNAMIC_NODE_RESOLVERS[name].toString()},
  },\n`;
      continue;
    }

    const spec = extractDOMSpec(type);

    if (!spec) {
      out += `  ${name}: null,\n`;
      continue;
    }

    const specStr = JSON.stringify(spec, null, 2);
    out += `  ${name}: {${specStr.slice(1, -1)}},\n`;
  }

  return out;
}

export function generateRenderMap() {
  const extensions = Object.values(defaultExtensions);
  const schema = getSchema(extensions as AnyExtension[]);
  let output = '';
  output += '// THIS FILE IS AUTO-GENERATED. DO NOT EDIT.\n';
  output += `import type { TiptapNodeAttributes } from './index';\n`;
  output += `/**
 * Render config for Tiptap nodes
 */
export const NODE_RENDER_MAP = {\n`;
  output += generateRenderEntries(schema.nodes, 'node');
  output += `} as const;\n\n`;
  return output;
}
