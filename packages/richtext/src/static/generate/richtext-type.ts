import type { AnyExtension } from '@tiptap/core';
import { getSchema } from '@tiptap/core';
import type { MarkType, NodeType, Schema } from 'prosemirror-model';
import { allAttrKeys, type ExtensionAttrMap } from '../../extensions/richtext-attrs';
import { getStoryblokTiptapExtensions } from '../../extensions';

const attrKeySet = new Set<keyof ExtensionAttrMap>(allAttrKeys);

/** Generate all node attribute interfaces and helpers */
function genAttributeTypes(schema: Schema) {
  let nodeAttrs = '';
  let markAttrs = '';

  for (const [name] of Object.entries(schema.nodes) as [string, NodeType][]) {
    if (attrKeySet.has(name as keyof ExtensionAttrMap)) {
      nodeAttrs += `  ${name}: NodeAttrTypeMap['${name}'];\n`;
    }
    else {
      nodeAttrs += `  ${name}: unknown;\n`;
    }
  }

  for (const [name] of Object.entries(schema.marks) as [string, MarkType][]) {
    if (attrKeySet.has(name as keyof ExtensionAttrMap)) {
      markAttrs += `  ${name}: MarkAttrTypeMap['${name}'];\n`;
    }
    else {
      markAttrs += `  ${name}: unknown;\n`;
    }
  }

  return { nodeAttrs, markAttrs };
}

/** Generate SbRichTextNode discriminated union type */
function genPMNode(schema: Schema): string {
  let out = 'export type SbRichTextNode =\n';

  for (const [name, type] of Object.entries(schema.nodes) as [string, NodeType][]) {
    const hasText = name === 'text' ? 'text: string;' : '';

    let children = '';
    if (type.isBlock || name === 'doc' || type.spec.content || type.isInline) {
      children = 'content?: SbRichTextNode[];';
    }
    out += `  | { type: '${name}'; attrs?: TiptapNodeAttributes['${name}']; ${children} marks?: SbRichTextMark[]; ${hasText} }\n`;
  }

  return `${out};`;
}

function genPMMark(schema: Schema): string {
  let out = 'export type SbRichTextMark =\n';
  for (const [name] of Object.entries(schema.marks)) {
    out += `  | { type: '${name}'; attrs?: TiptapMarkAttributes['${name}']; }\n`;
  }
  return `${out};`;
}

export function generateTypes() {
  const defaultExtensions = getStoryblokTiptapExtensions({});
  const extensions = Object.values(defaultExtensions);
  const schema = getSchema(extensions as AnyExtension[]);
  const attributeTypes = genAttributeTypes(schema);

  let output = '';
  output += '// THIS FILE IS AUTO-GENERATED. DO NOT EDIT.\n';
  output += `import type { MarkAttrTypeMap, NodeAttrTypeMap } from '../extensions/richtext-attrs';\n`;
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
  // --- SbRichTextNode/SbRichTextMark
  output += `${genPMNode(schema)}\n\n`;
  output += `${genPMMark(schema)}\n\n`;
  return output;
}
