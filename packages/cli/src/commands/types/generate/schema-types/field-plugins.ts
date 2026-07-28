import { existsSync } from 'node:fs';
import { resolve } from 'pathe';

import { CommandError, toError } from '../../../../utils';
import { isRecord } from '../../../schema/utils';

/** Where a field-plugin declaration module is looked for when no override is given. */
export const FIELD_PLUGINS_CONVENTION_PATH = '.storyblok/schema/schema.ts';

/**
 * Where the generated `FieldPlugins` type comes from.
 *
 * - `schema`, the module exports a `defineSchema` result named `schema` (what
 *   `schema init` writes).
 * - `record`, the module exports a bare `fieldPlugins` record.
 * - `none`: nothing to import; `FieldPlugins` becomes `Record<never, never>`.
 */
export type FieldPluginsSource =
  | { kind: 'none' }
  | { kind: 'schema'; modulePath: string; fieldTypes: string[] }
  | { kind: 'record'; modulePath: string; fieldTypes: string[] };

/** Collects the `fieldType` of every entry in a `fieldPlugins` record. */
function collectFieldTypes(fieldPlugins: Record<string, unknown>): string[] {
  const fieldTypes: string[] = [];
  for (const plugin of Object.values(fieldPlugins)) {
    if (isRecord(plugin) && typeof plugin.fieldType === 'string' && !fieldTypes.includes(plugin.fieldType)) {
      fieldTypes.push(plugin.fieldType);
    }
  }
  return fieldTypes;
}

/**
 * Resolves the module whose `defineFieldPlugin` declarations type `custom`
 * fields. The module is loaded with `jiti` (TypeScript-aware) purely to detect
 * which export shape it has and which `fieldType`s it registers, the generated
 * file imports it by path and lets TypeScript do the real work.
 *
 * An explicit `--field-plugins` path that is missing or unusable is an error;
 * the convention path silently degrades to `none`, since most spaces have no
 * custom fields.
 */
export async function resolveFieldPluginsSource(
  options: { cwd: string; override?: string },
): Promise<FieldPluginsSource> {
  const isExplicit = options.override !== undefined;
  const modulePath = resolve(options.cwd, options.override ?? FIELD_PLUGINS_CONVENTION_PATH);

  if (!existsSync(modulePath)) {
    if (isExplicit) {
      throw new CommandError(`Field plugins module not found: ${modulePath}`);
    }
    return { kind: 'none' };
  }

  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, { interopDefault: true });

  let module: Record<string, unknown>;
  try {
    module = await jiti.import(modulePath) as Record<string, unknown>;
  }
  catch (maybeError) {
    throw new CommandError(`Failed to load field plugins from ${modulePath}: ${toError(maybeError).message}`);
  }

  const schemaExport = module.schema;
  if (isRecord(schemaExport) && isRecord(schemaExport.fieldPlugins)) {
    return { kind: 'schema', modulePath, fieldTypes: collectFieldTypes(schemaExport.fieldPlugins) };
  }

  if (isRecord(module.fieldPlugins)) {
    return { kind: 'record', modulePath, fieldTypes: collectFieldTypes(module.fieldPlugins) };
  }

  if (isExplicit) {
    throw new CommandError(
      `${modulePath} exports neither a \`schema\` (a defineSchema result with fieldPlugins) nor a \`fieldPlugins\` record.`,
    );
  }
  return { kind: 'none' };
}
