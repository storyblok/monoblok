import type { AnyExtension } from '@tiptap/core';
import { getSchema } from '@tiptap/core';
import type { AttributeSpec, MarkType, NodeType, Schema } from 'prosemirror-model';
import { markAttrKeys, nodeAttrKeys } from '../../extensions/richtext-attrs';
import { getStoryblokExtensions } from '../../extensions';
import { hints } from './type-hints';

const nodeAttrKeySet = new Set<string>(nodeAttrKeys);
const markAttrKeySet = new Set<string>(markAttrKeys);

/**
 * Converts a schema attrs object to a TS property string (with type from hints)
 * E.g. { color: { default: null } } -> 'color?: string | null;'
 */
function getAttrType(attrName: string): string {
  return hints[attrName] || 'unknown';
}

function genAttrsType(attrs: Record<string, AttributeSpec> | undefined): string {
  if (!attrs || Object.keys(attrs).length === 0) {
    return 'Record<string, never>';
  }
  let out = '{ ';
  for (const [attrName] of Object.entries(attrs)) {
    const typeStr = getAttrType(attrName);
    out += `${attrName}?: ${typeStr}; `;
  }
  out += '}';
  return out;
}

/** Generate all node attribute interfaces and helpers */
function genAttributeTypes(schema: Schema) {
  let nodeAttrs = '';
  let markAttrs = '';

  for (const [name, type] of Object.entries(schema.nodes) as [string, NodeType][]) {
    if (nodeAttrKeySet.has(name)) {
      nodeAttrs += `  ${name}: NodeAttrTypeMap['${name}'];\n`;
    }
    else {
      nodeAttrs += `  ${name}: ${genAttrsType(type.spec.attrs)};\n`;
    }
  }

  for (const [name, type] of Object.entries(schema.marks) as [string, MarkType][]) {
    if (markAttrKeySet.has(name)) {
      markAttrs += `  ${name}: MarkAttrTypeMap['${name}'];\n`;
    }
    else {
      markAttrs += `  ${name}: ${genAttrsType(type.spec.attrs)};\n`;
    }
  }

  return { nodeAttrs, markAttrs };
}

/** Generate PMNode discriminated union type */
function genPMNode(schema: Schema): string {
  let out = 'export type PMNode =\n';

  for (const [name, type] of Object.entries(schema.nodes) as [string, NodeType][]) {
    const hasText = name === 'text' ? 'text: string;' : '';

    let children = '';
    if (type.isBlock || name === 'doc' || type.spec.content || type.isInline) {
      children = 'content?: PMNode[];';
    }
    out += `  | { type: '${name}'; attrs?: TiptapNodeAttributes['${name}']; ${children} marks?: PMMark[]; ${hasText} }\n`;
  }

  return `${out};`;
}

function genPMMark(schema: Schema): string {
  let out = 'export type PMMark =\n';
  for (const [name] of Object.entries(schema.marks)) {
    out += `  | { type: '${name}'; attrs?: TiptapMarkAttributes['${name}']; }\n`;
  }
  return `${out};`;
}

export function generateTypes() {
  const defaultExtensions = getStoryblokExtensions({
    allowCustomAttributes: true,
  });
  const extensions = Object.values(defaultExtensions);
  const schema = getSchema(extensions as AnyExtension[]);
  const attributeTypes = genAttributeTypes(schema);

  let output = '';
  output += '// THIS FILE IS AUTO-GENERATED. DO NOT EDIT.\n';
  output += `import type { MarkAttrTypeMap, NodeAttrTypeMap } from '../extensions/richtext-attrs';\n`;
  output += `import type { SbBlokData } from './types';\n`;
  output += '\n';
  // --- Attribute types
  output += '/** Attribute types for all Tiptap node extensions */\n';
  output += 'export interface TiptapNodeAttributes {\n';
  output += attributeTypes.nodeAttrs;
  output += '}\n\n';
  output += '/** Attribute types for all Tiptap mark extensions */\n';
  output += 'export interface TiptapMarkAttributes {\n';
  output += attributeTypes.markAttrs;
  output += '}\n\n';
  // --- Node name unions
  output += 'export type TiptapNodeName = keyof TiptapNodeAttributes;\n';
  output += 'export type TiptapMarkName = keyof TiptapMarkAttributes;\n';
  // --- PMNode/PMMark
  output += `${genPMNode(schema)}\n\n`;
  output += `${genPMMark(schema)}\n\n`;
  return output;
}
