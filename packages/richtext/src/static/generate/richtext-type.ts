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

function nodeShape(schema: Schema, name: string): string {
  const type = schema.nodes[name];
  const hasText = name === 'text' ? 'text: string;' : '';
  let children = '';
  // The root `doc` node is the document body and always carries a `content`
  // array, so it is required. Every other node may legitimately omit `content`,
  // for example an empty paragraph or a leaf node like `image`, so for those it
  // stays optional, matching what the Storyblok API actually returns. See #16.
  if (name === 'doc') {
    children = 'content: SbRichTextNode[];';
  }
  else if (type.isBlock || type.spec.content || type.isInline) {
    children = 'content?: SbRichTextNode[];';
  }
  return `{ type: '${name}'; attrs?: TiptapNodeAttributes['${name}']; ${children} marks?: SbRichTextMark[]; ${hasText} _key?: string; context?: TContext; }`;
}

function markShape(name: string): string {
  return `{ type: '${name}'; attrs?: TiptapMarkAttributes['${name}']; _key?: string; }`;
}

/** Generate SbRichTextNode discriminated union type */
function genPMNode(schema: Schema): string {
  let out = 'export type SbRichTextNode<TContext = unknown> =\n';
  for (const [name] of Object.entries(schema.nodes) as [string, NodeType][]) {
    out += `  | ${nodeShape(schema, name)}\n`;
  }
  return `${out};`;
}

function genPMMark(schema: Schema): string {
  let out = 'export type SbRichTextMark =\n';
  for (const [name] of Object.entries(schema.marks)) {
    out += `  | ${markShape(name)}\n`;
  }
  return `${out};`;
}

/**
 * Generate a flat lookup interface keyed by element name.
 * This allows `SbRichTextElementByType[T]` indexed access to resolve to the
 * concrete node/mark shape, which is supported by Vue's `<script setup>`
 * `defineProps<T>()` type-only macro resolver (conditional/Extract are not).
 */
function genElementByType(schema: Schema): string {
  let out = '/**\n * Flat lookup of element shapes keyed by `type`.\n';
  out += ' * Prefer this over `Extract<SbRichTextNode, { type: T }>` in places\n';
  out += ' * that need to be resolved by limited type resolvers (e.g. Vue SFC macros).\n */\n';
  out += 'export interface SbRichTextElementByType<TContext = unknown> {\n';
  for (const [name] of Object.entries(schema.nodes) as [string, NodeType][]) {
    out += `  ${name}: ${nodeShape(schema, name)};\n`;
  }
  for (const [name] of Object.entries(schema.marks)) {
    out += `  ${name}: ${markShape(name)};\n`;
  }
  out += '}\n';
  return out;
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
  output += `${genElementByType(schema)}\n`;
  return output;
}
