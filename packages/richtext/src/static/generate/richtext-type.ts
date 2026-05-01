import type { AnyExtension } from '@tiptap/core';
import { getSchema } from '@tiptap/core';
import type { AttributeSpec, MarkType, NodeType, Schema } from 'prosemirror-model';
import { markSchemas, nodeSchemas } from '../../extensions/attribute-schema';
import { getStoryblokExtensions } from '../../extensions';
import { hints } from './type-hints';

/** Keys derived from nodeSchemas/markSchemas objects. */
const nodeSchemaKeys = new Set(Object.keys(nodeSchemas));
const markSchemaKeys = new Set(Object.keys(markSchemas));

/** Valibot schema entry type. */
interface ValibotEntry {
  type: string;
  expects: string;
  default?: unknown;
  wrapped?: ValibotEntry;
  item?: ValibotEntry;
  entries?: Record<string, ValibotEntry>;
}

/** Valibot object schema type. */
interface ValibotObjectSchema {
  type: 'object';
  entries: Record<string, ValibotEntry>;
}

/** Checks if an entry is optional (without a default value). */
function isOptionalWithoutDefault(entry: ValibotEntry): boolean {
  return entry.type === 'optional' && entry.default === undefined;
}

/**
 * Converts a Valibot entry to a TypeScript type string.
 * Uses the `expects` property but fixes optional types with defaults.
 */
function entryToTypeString(entry: ValibotEntry): string {
  // For optional with default, use the wrapped type (not "type | undefined")
  if (entry.type === 'optional' && entry.default !== undefined && entry.wrapped) {
    return entryToTypeString(entry.wrapped);
  }

  // For optional without default, unwrap and return inner type (optionality handled via `?`)
  if (entry.type === 'optional' && entry.default === undefined && entry.wrapped) {
    return entryToTypeString(entry.wrapped);
  }

  // For nullable, wrap the inner type with "| null"
  if (entry.type === 'nullable' && entry.wrapped) {
    return `${entryToTypeString(entry.wrapped)} | null`;
  }

  // For nested objects, recurse
  if (entry.type === 'object' && entry.entries) {
    return schemaToInlineType(entry as ValibotObjectSchema);
  }

  // For arrays, get item type
  if (entry.type === 'array' && entry.item) {
    return `${entryToTypeString(entry.item)}[]`;
  }

  // For picklist, expects already has the union format
  if (entry.type === 'picklist') {
    return entry.expects;
  }

  // Default: use expects (string, number, boolean, etc.)
  return entry.expects;
}

/** Generates inline type string from a Valibot object schema. */
function schemaToInlineType(schema: ValibotObjectSchema): string {
  const props = Object.entries(schema.entries)
    .map(([key, entry]) => {
      const isOptional = isOptionalWithoutDefault(entry);
      const propKey = isOptional ? `${key}?` : key;
      return `${propKey}: ${entryToTypeString(entry)};`;
    })
    .join(' ');
  return `{ ${props} }`;
}

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
    // Use schema type if available, otherwise generate from hints
    if (nodeSchemaKeys.has(name) && name in nodeSchemas) {
      const entry = nodeSchemas[name as keyof typeof nodeSchemas];
      const inlineType = schemaToInlineType(entry.schema as unknown as ValibotObjectSchema);
      nodeAttrs += `  ${name}: ${inlineType};\n`;
    }
    else {
      nodeAttrs += `  ${name}: ${genAttrsType(type.spec.attrs)};\n`;
    }
  }

  for (const [name, type] of Object.entries(schema.marks) as [string, MarkType][]) {
    // Use schema type if available, otherwise generate from hints
    if (markSchemaKeys.has(name) && name in markSchemas) {
      const entry = markSchemas[name as keyof typeof markSchemas];
      const inlineType = schemaToInlineType(entry.schema as unknown as ValibotObjectSchema);
      markAttrs += `  ${name}: ${inlineType};\n`;
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
  // Remove 'text' from component names since user dont need to provide a component for text nodes
  output += `export type TiptapComponentName = Exclude<TiptapNodeName | TiptapMarkName, 'text'>;\n\n`;
  // --- PMNode/PMMark
  output += `${genPMNode(schema)}\n\n`;
  output += `${genPMMark(schema)}\n\n`;
  return output;
}
