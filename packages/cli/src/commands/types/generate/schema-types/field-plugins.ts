import { existsSync } from 'node:fs';
import { resolve } from 'pathe';

import { CommandError, toError } from '../../../../utils';
import { DEFAULT_STORAGE_DIR } from '../../../../utils/filesystem';
import { importModule } from '../../../../utils/import-module';
import { SCHEMA_ENTRY_RELATIVE_PATH } from '../../../schema/constants';
import { isRecord } from '../../../schema/utils';

/**
 * Where the generated `FieldPlugins` type comes from.
 *
 * - `schema`, the module exports a `defineSchema` result named `schema` (what
 *   `schema init` writes).
 * - `record`, the module exports a bare `fieldPlugins` record.
 * - `none`: nothing to import; `FieldPlugins` becomes `Record<never, never>`.
 *
 * `none` carries the path that was searched, so a message telling the user where
 * to put a module names the path this run actually looked at. `--path` moves it,
 * and naming the default there would point at a file the user may already have.
 *
 * It also carries *why* nothing resolved, because the two cases need opposite
 * advice: `missing` means write a module at that path, `unusable` means the
 * module is already there and its export needs renaming. `schema init` writes a
 * `schema` export with no `fieldPlugins` key, so `unusable` is the case a user
 * following the docs hits first, and telling them to create a file they are
 * looking at reads as the command failing to see it.
 */
export type FieldPluginsSource =
  | { kind: 'none'; reason: 'missing' | 'unusable'; searchedPath: string; nearMissExport?: string }
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
 * Names an export that looks like it was meant to be picked up but is not named
 * `schema` or `fieldPlugins`, so the error can point at the near miss instead of
 * only restating the contract. Returns the first such export name.
 *
 * Both accepted shapes are recognised, a `defineSchema` result carrying
 * `fieldPlugins` and a bare record of `defineFieldPlugin` results. Only the
 * error message is affected: the emitted file imports the export by name, so
 * accepting an arbitrary name would mean threading it through rendering too.
 */
function findNearMissExport(module: Record<string, unknown>): string | undefined {
  for (const [name, value] of Object.entries(module)) {
    if (name === 'schema' || name === 'fieldPlugins' || name === 'default') { continue; }
    if (!isRecord(value)) { continue; }
    if (isRecord(value.fieldPlugins)) { return name; }
    const entries = Object.values(value);
    if (entries.length > 0 && entries.every(entry => isRecord(entry) && typeof entry.fieldType === 'string')) {
      return name;
    }
  }
  return undefined;
}

/**
 * Resolves the module whose `defineFieldPlugin` declarations type `custom`
 * fields. The generated file imports the module by path and lets TypeScript do
 * the real work; this only needs to know which export shape it has and which
 * `fieldType`s it registers.
 *
 * Detecting that means *executing* the module, since the shape is a runtime
 * value. So any top-level side effects in the user's schema file run on every
 * `types generate`. `schema push` loads the same file the same way, but there
 * execution is the point rather than a means of inspection.
 *
 * An explicit `--field-plugins` path that is missing or unusable is an error;
 * the convention path degrades to `none`, since most spaces have no custom
 * fields. That degradation is not silent in the case that matters: a `custom`
 * field with no registered plugin is reported afterwards as an unmapped
 * `field_type`.
 */
export async function resolveFieldPluginsSource(
  options: { cwd: string; path?: string; override?: string },
): Promise<FieldPluginsSource> {
  const isExplicit = options.override !== undefined;
  const modulePath = options.override === undefined
    // Honours `--path`, the same base the generated types are written under.
    ? resolve(options.cwd, options.path ?? DEFAULT_STORAGE_DIR, SCHEMA_ENTRY_RELATIVE_PATH)
    : resolve(options.cwd, options.override);

  if (!existsSync(modulePath)) {
    if (isExplicit) {
      throw new CommandError(`Field plugins module not found: ${modulePath}`);
    }
    return { kind: 'none', reason: 'missing', searchedPath: modulePath };
  }

  let module: Record<string, unknown>;
  try {
    module = await importModule(modulePath);
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

  const nearMiss = findNearMissExport(module);
  if (isExplicit) {
    throw new CommandError(
      `${modulePath} exports neither a \`schema\` (a defineSchema result with fieldPlugins) nor a \`fieldPlugins\` record.${
        nearMiss === undefined
          ? ''
          : ` Found \`${nearMiss}\`, which looks like one: rename it to \`schema\` or \`fieldPlugins\`.`}`,
    );
  }
  // The convention path degrades rather than failing, but the near miss is still
  // worth carrying: the unmapped-field-type warning can then name the export to
  // rename instead of restating the contract.
  return { kind: 'none', reason: 'unusable', searchedPath: modulePath, ...(nearMiss === undefined ? {} : { nearMissExport: nearMiss }) };
}
