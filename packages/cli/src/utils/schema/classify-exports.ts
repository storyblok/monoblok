/**
 * Shared classification of a schema entry file's exports.
 *
 * The content-shape DSL (`defineBlock` / `defineDatasource`) produces plain
 * objects. This module recognizes them among a module's exports and collects
 * the raw definitions — de-duplicated by object identity and unwrapping an
 * exported `schema` object. Consumers then map to their own target shape:
 * `schema push` maps to the MAPI wire form, while `schema validate` /
 * `stories validate` pass the raw definitions straight to the
 * `@storyblok/schema` validators.
 */

import { stat } from "node:fs/promises";
import { resolve } from "pathe";
import { CommandError } from "../error/command-error";
import { isRecord } from "../object";

/** Returns true if the value looks like a `defineBlock()` result (content-shape DSL). */
export function isComponent(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && typeof value.name === "string" && Array.isArray(value.fields);
}

/** Returns true if the value looks like a `defineDatasource()` result. */
export function isDatasource(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.slug === "string" &&
    !Array.isArray(value.fields)
  );
}

/** Returns true if the value looks like a `defineFolder()` result. */
export function isFolder(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.path === "string" &&
    !Array.isArray(value.fields) &&
    !("slug" in value)
  );
}

/**
 * Returns true if the value looks like a `defineFieldPlugin()` result: a
 * `fieldType` literal bound to a `value` validator. Field plugins carry no
 * `name`, so they never collide with the block/datasource/folder guards.
 */
export function isFieldPlugin(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && typeof value.fieldType === "string" && "value" in value;
}

/** Returns true if the value looks like a schema object (e.g. `export const schema = { blocks: {...}, datasources: {...}, folders: {...} }`). */
export function isSchemaObject(value: unknown): value is Record<string, Record<string, unknown>> {
  return (
    isRecord(value) &&
    ("blocks" in value || "datasources" in value || "folders" in value || "fieldPlugins" in value)
  );
}

/** Raw component, datasource, folder, and field-plugin definitions collected from a module's exports. */
export interface CollectedSchemaExports {
  components: Record<string, unknown>[];
  datasources: Record<string, unknown>[];
  folders: Record<string, unknown>[];
  fieldPlugins: Record<string, unknown>[];
}

/**
 * Walks a module's exports (directly or via an exported `schema` object) and
 * collects the raw component, datasource, folder, and field-plugin definitions.
 * The definitions are returned verbatim — no shape mapping is applied.
 *
 * De-duplication is by object identity, not by name: a definition commonly
 * appears twice as the SAME reference (exported directly and again inside an
 * exported `schema` object) and must be collapsed. Two DIFFERENT definitions
 * that share a name are both kept, so every consumer sees the collision rather
 * than silently losing one: `schema validate` reports it as
 * `duplicate_block_name` / `duplicate_datasource_name` /
 * `duplicate_datasource_slug`, and `schema push` rejects the entry file before it
 * touches the API (see `classifyExports`).
 */
export function collectSchemaExports(
  moduleExports: Record<string, unknown>,
): CollectedSchemaExports {
  const components: Record<string, unknown>[] = [];
  const datasources: Record<string, unknown>[] = [];
  const folders: Record<string, unknown>[] = [];
  const fieldPlugins: Record<string, unknown>[] = [];
  const seen = new Set<unknown>();

  function collect(value: unknown) {
    if (isComponent(value)) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
      components.push(value);
    } else if (isFolder(value)) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
      folders.push(value);
    } else if (isDatasource(value)) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
      datasources.push(value);
    } else if (isFieldPlugin(value)) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
      fieldPlugins.push(value);
    }
  }

  for (const value of Object.values(moduleExports)) {
    if (isSchemaObject(value)) {
      // Unwrap schema object: collect from each sub-record (blocks, datasources, folders).
      for (const group of Object.values(value)) {
        if (isRecord(group)) {
          for (const entity of Object.values(group)) {
            collect(entity);
          }
        }
      }
    } else {
      collect(value);
    }
  }

  return { components, datasources, folders, fieldPlugins };
}

/**
 * Loads a TypeScript schema entry file via jiti and returns its raw module
 * exports. The path is resolved to an absolute path first, so jiti's base URL
 * is irrelevant. Shared by `schema push` (wire mapping) and the validate
 * commands (DSL shape). The jiti import throws when the path cannot be
 * resolved — fatal for the callers.
 *
 * A missing entry file is a bad invocation, so it surfaces as a
 * {@link CommandError} instead of Node's resolution failure with its `Require
 * stack:` dump. The file is checked before the import rather than by inspecting
 * the failure: a module the entry file itself imports and cannot resolve raises
 * `Cannot find module '<specifier>'` with a `Require stack:` naming the entry
 * file, so matching the entry path against the message reported a missing
 * dependency as a missing entry file.
 */
export async function loadSchemaModule(entryPath: string): Promise<Record<string, unknown>> {
  const entryAbs = resolve(entryPath);
  try {
    await stat(entryAbs);
  } catch {
    throw new CommandError(`Schema entry file not found at "${entryPath}".`);
  }
  const { createJiti } = await import("jiti");
  const jiti = createJiti(import.meta.url, { interopDefault: true, tsconfigPaths: true });
  return (await jiti.import(entryAbs)) as Record<string, unknown>;
}
