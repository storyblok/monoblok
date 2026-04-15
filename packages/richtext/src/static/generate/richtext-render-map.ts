import { type AnyExtension, getSchema } from '@tiptap/core';
import { getStoryblokExtensions } from '../../extensions';
import type { Schema } from 'prosemirror-model';
import { MarkType, NodeType } from 'prosemirror-model';
import { parseDOMSpec } from './parse-dom-spec';

/**
 * Known dynamic resolvers (hand-written, minimal set)
 * These handle cases where toDOM depends on attrs
 */
const DYNAMIC_NODE_RESOLVERS: Record<string, string> = {
  heading: `resolveHeadingTag`,
};

function getMockAttrs(type: MarkType | NodeType) {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(type.spec.attrs || {})) {
    const attr: any = val;
    result[key] = attr.default ?? null;
  }

  return result;
}

/**
 * Extract DOM spec from a node/mark
 */
function extractDOMSpec(type: MarkType | NodeType) {
  if (!type.spec.toDOM) {
    return null;
  }
  try {
    if (type instanceof NodeType) {
      const node = type.createAndFill(getMockAttrs(type)) ?? type.create(getMockAttrs(type));
      return parseDOMSpec(type.spec.toDOM(node));
    }
    if (type instanceof MarkType) {
      const mark = type.create(getMockAttrs(type));
      return parseDOMSpec(type.spec.toDOM(mark, true));
    }
    return null;
  }
  catch {
    return null;
  }
}

/**
 * Generate render map entries
 */
function generateRenderEntries(
  schema: Schema,
  kind: 'node' | 'mark',
) {
  let out = '';
  const types = kind === 'node' ? schema.nodes : schema.marks;
  for (const [name, type] of Object.entries(types) as [string, NodeType | MarkType][]) {
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
  const defaultExtensions = getStoryblokExtensions();
  const extensions = Object.values(defaultExtensions);
  const schema = getSchema(extensions as AnyExtension[]);
  let output = '';
  output += '// THIS FILE IS AUTO-GENERATED. DO NOT EDIT.\n';
  output += `import { resolveHeadingTag } from './dynamic-resolvers';\n`;
  output += `/**
  * Render config for Tiptap nodes
  */
  export const NODE_RENDER_MAP = {\n`;
  output += generateRenderEntries(schema, 'node');
  output += `} as const;\n\n`;
  output += `/**
  * Render config for Tiptap marks
  */
  export const MARK_RENDER_MAP = {\n`;
  output += generateRenderEntries(schema, 'mark');
  output += `} as const;\n\n`;
  return output;
}
