import { DENIABLE_FIELD_TYPES } from "@storyblok/schema";

import type { Component, Datasource, Field } from "../../types";
import { isRecord } from "./utils";
import { slugifyPath } from "./folders";

/** The two halves of an `allow`/`deny` list: block names and slugified folder paths. */
interface SplitRestriction {
  names: unknown;
  folderPaths: string[];
}

/**
 * Splits an `allow`/`deny` value into its block-name and folder halves. Folder
 * entries arrive as `{ folder: displayPath }` from `defineField` and are
 * slugified into the transient slug-path space that `schema push` later resolves
 * to group uuids. A non-array value is passed through as the name list, since
 * hand-written schema data may hold a bare name.
 */
function splitRestriction(input: unknown): SplitRestriction | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!Array.isArray(input)) {
    return { names: input, folderPaths: [] };
  }
  return {
    names: input.filter((entry) => typeof entry === "string"),
    folderPaths: input
      .filter(
        (entry): entry is { folder: string } => isRecord(entry) && typeof entry.folder === "string",
      )
      .map((entry) => slugifyPath(entry.folder)),
  };
}

/**
 * Maps a single content-shape DSL field to its MAPI wire form. The field's
 * `name` becomes the schema record key (returned separately); the DSL reference
 * keys are renamed to their wire equivalents:
 * - `allow` → `component_whitelist` (for block-name entries) or
 *   `component_group_whitelist` (for folder entries)
 * - `deny` → `component_denylist` / `component_group_denylist`, the same split
 * - `datasource` → `datasource_slug` (the `source` selector passes through)
 *
 * A bare list is ignored by the editor, so a restriction from either key also
 * activates `restrict_components: true` on `bloks` and `richtext` fields, the two
 * types whose nested-block picker consults these lists, with `restrict_type:
 * 'groups'` for folder entries and `''` (the editor's v1-compatible spelling of
 * "by block name") otherwise. `defineField` rejects an `allow`/`deny` pair that
 * disagrees on which of the two dimensions to restrict by, so the folder dimension
 * of either key settles it for both.
 *
 * On any other field type a `deny` is dropped: those types have no denylist, so
 * writing one would leave a key nothing reads. `allow` still passes through,
 * because `component_whitelist` is real on `multilink`, where it selects story
 * content types rather than blocks, and it keeps the plain list with no
 * restriction flags.
 *
 * Every other key (`type`, `pos`, `source`, `required`, validation options, and
 * `type: 'custom'` plugin extras) is preserved verbatim.
 */
export function mapFieldToWire(field: Record<string, unknown>): { name: string; value: Field } {
  const { name, allow, deny, datasource, ...rest } = field;

  const value: Record<string, unknown> = { ...rest };
  const allowed = splitRestriction(allow);
  const denied = splitRestriction(deny);

  if (allowed) {
    if (allowed.folderPaths.length > 0) {
      value.component_group_whitelist = allowed.folderPaths;
    } else {
      value.component_whitelist = allowed.names;
    }
  }
  // Only `bloks` and `richtext` have a denylist, so a `deny` elsewhere is
  // dropped rather than written. `defineField` rejects it outright; this is the
  // backstop for a schema authored in plain JavaScript, which never goes through
  // that guard.
  const isDeniable = DENIABLE_FIELD_TYPES.includes(String(rest.type));
  if (denied && isDeniable) {
    if (denied.folderPaths.length > 0) {
      value.component_group_denylist = denied.folderPaths;
    } else {
      value.component_denylist = denied.names;
    }
  }
  if ((allowed || denied) && isDeniable) {
    const byFolder = Boolean(allowed?.folderPaths.length || denied?.folderPaths.length);
    value.restrict_components = true;
    value.restrict_type = byFolder ? "groups" : "";
  }
  if (datasource !== undefined) {
    value.datasource_slug = datasource;
  }

  // The wire `Field` is a loose, fully-optional index shape; the structural
  // contract is exercised by the map-to-wire tests rather than the compiler.
  return { name: typeof name === "string" ? name : "", value: value as Field };
}

/**
 * Maps a content-shape DSL block (the result of `defineBlock`) to a MAPI wire
 * `Component`. The ordered `fields` array becomes a `schema` record keyed by
 * field name (each field keeps its `pos`); the `folder` display path is slugified
 * to a slug path (transient key); everything else passes through.
 */
export function mapBlockToWire(block: Record<string, unknown>): Component {
  const { fields, folder, ...rest } = block;

  const schema: Record<string, Field> = {};
  if (Array.isArray(fields)) {
    for (const field of fields) {
      if (!isRecord(field)) {
        continue;
      }
      const { name, value } = mapFieldToWire(field);
      if (name) {
        schema[name] = value;
      }
    }
  }

  return {
    ...rest,
    ...(folder !== undefined && {
      folder: typeof folder === "string" ? slugifyPath(folder) : null,
    }),
    schema,
  } as unknown as Component;
}

/**
 * Maps a content-shape DSL datasource (the result of `defineDatasource`) to its
 * wire form. The DSL and wire shapes are identical, so this is a passthrough.
 */
export function mapDatasourceToWire(datasource: Record<string, unknown>): Datasource {
  return datasource as unknown as Datasource;
}
