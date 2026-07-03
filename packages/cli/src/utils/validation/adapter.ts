/**
 * The single point where the CLI depends on `@storyblok/schema`. Command code
 * and formatters import validators, types, and the schema loader from here so
 * the coupling to the schema package lives in one file.
 */

import type { SchemaLike, ValidationIssue, ValidationResult, ValidationSeverity } from '@storyblok/schema';
import { CommandError } from '../error';
import { collectSchemaExports, loadSchemaModule } from '../schema/classify-exports';

export type { SchemaLike, ValidationIssue, ValidationResult, ValidationSeverity };

// `@storyblok/schema` pulls in zod and the generated content-shape schemas.
// Import it lazily inside the validators (not at module load) so registering
// the validate commands does not add that cost to every CLI invocation.

/** Validates a code-defined schema. Loads `@storyblok/schema` on first use. */
export async function validateSchema(schema: SchemaLike): Promise<ValidationResult> {
  const schemaPkg = await import('@storyblok/schema');
  return schemaPkg.validateSchema(schema);
}

/** Validates a story's content against a schema. Loads `@storyblok/schema` on first use. */
export async function validateStory(story: unknown, schema: SchemaLike): Promise<ValidationResult> {
  const schemaPkg = await import('@storyblok/schema');
  return schemaPkg.validateStory(story, schema);
}

/** A schema entry file loaded into the shape the validators accept. */
export interface LoadedSchema {
  schema: SchemaLike;
  /** Number of blocks + datasources defined in the entry file. */
  entityCount: number;
}

/**
 * Loads a TypeScript schema entry file via jiti and returns it in the loose
 * `SchemaLike` shape the validators accept. Blocks and datasources are sourced
 * from the entry file's exports, directly or via an exported `schema` object.
 *
 * Throws when the file exports no schema definitions; the jiti import itself
 * throws when the path cannot be resolved. Both are fatal for the caller.
 */
export async function loadSchemaEntry(entryPath: string): Promise<LoadedSchema> {
  const entryMod = await loadSchemaModule(entryPath);
  const { components, datasources } = collectSchemaExports(entryMod);

  if (components.length === 0 && datasources.length === 0) {
    throw new CommandError(
      'No blocks or datasources found in the schema entry file. Verify the file exports schema definitions.',
    );
  }

  // jiti yields untyped module objects; collectSchemaExports's guards confirm
  // each entry is a `define*()` result, which conforms to the loose SchemaLike
  // runtime contract the validators accept.
  const schema = { blocks: components, datasources } as unknown as SchemaLike;
  return { schema, entityCount: components.length + datasources.length };
}
