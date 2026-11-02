import { DENIABLE_FIELD_TYPES } from "@storyblok/schema";
import { formatValue, sortSchemaByPos } from "@storyblok/schema/internal/codegen";

import {
  COMPONENT_STRIP_KEYS,
  DATASOURCE_DIMENSION_STRIP_KEYS,
  DATASOURCE_STRIP_KEYS,
  RESTRICTION_LIST_KEYS,
  stripKeys,
} from "./utils";

/**
 * Restriction keys only `bloks` and `richtext` fields read. The editor ignores
 * them on every other field type (a space keeps them there after a field's type
 * was changed), so they carry no state and are dropped. `component_whitelist`
 * is not among them: on `multilink` it selects story content types.
 */
const BLOCK_RESTRICTION_ONLY_KEYS = [
  "restrict_components",
  "restrict_type",
  "component_denylist",
  "component_group_whitelist",
  "component_group_denylist",
  "component_tag_whitelist",
  "component_tag_denylist",
] as const;

/**
 * Whether an empty list is the field's real state rather than an unset key. A
 * field plugin rejects a schema whose `options` is not a list, so a `custom`
 * field without `options` breaks its plugin, while every other empty list reads
 * the same as an absent key.
 */
function isMeaningfulEmptyList(field: Record<string, unknown>, key: string): boolean {
  return field.type === "custom" && key === "options";
}

/**
 * Drops the restriction keys the editor does not read for this field, so a list
 * a space still stores but no longer enforces does not diff against a schema
 * that omits it:
 * - on a field type that has no block restriction at all,
 * - every list while `restrict_components` is explicitly `false`,
 * - a folder or tag whitelist while `restrict_type` selects another dimension.
 *   Denylists are not gated on `restrict_type` and are kept.
 */
function omitInertRestrictions(field: Record<string, unknown>): void {
  if (!DENIABLE_FIELD_TYPES.includes(String(field.type))) {
    for (const key of BLOCK_RESTRICTION_ONLY_KEYS) {
      delete field[key];
    }
    return;
  }
  if (field.restrict_components === false) {
    for (const key of RESTRICTION_LIST_KEYS) {
      delete field[key];
    }
    return;
  }
  if (field.restrict_type !== "groups") {
    delete field.component_group_whitelist;
  }
  if (field.restrict_type !== "tags") {
    delete field.component_tag_whitelist;
  }
}

/**
 * Reduces a schema field to the state the editor acts on, so two fields that
 * behave the same compare equal: API-assigned `id` stripped, `null` treated as
 * absent, and a `name` that repeats the field's schema key (the editor writes
 * one onto tabs it reorders) dropped.
 */
function normalizeField(key: string, field: Record<string, unknown>): Record<string, unknown> {
  const { id, ...rest } = field;
  if (rest.name === key) {
    delete rest.name;
  }
  // `restrict_type: ''` is the wire byproduct of a component whitelist (the
  // "restrict by component" mode). The Visual Editor treats `''` and absent
  // identically, so a value re-derived from the DSL `allow` must not diff
  // against a remote that lacks the key. A non-empty `restrict_type`
  // (`'groups'`/`'tags'`) is real state and is kept.
  if (rest.restrict_type === "") {
    delete rest.restrict_type;
  }
  omitInertRestrictions(rest);
  for (const [prop, value] of Object.entries(rest)) {
    const isEmptyList = Array.isArray(value) && value.length === 0;
    if (value === null || (isEmptyList && !isMeaningfulEmptyList(rest, prop))) {
      delete rest[prop];
    }
  }
  return rest;
}

/**
 * Sorts schema fields into editor order and normalizes each (see
 * {@link normalizeField}).
 *
 * The editor orders fields by `pos` and reads nothing else from it, and a space
 * routinely holds gaps, duplicates, and fields without one (reordering tabs
 * renumbers the tabs only), while a schema written in code numbers its fields
 * contiguously. So `pos` is replaced by each field's rank: only the order is
 * compared.
 */
function normalizeSchemaFields(
  schema: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    sortSchemaByPos(schema).map(([key, field], rank) => [
      key,
      { ...normalizeField(key, field), pos: rank },
    ]),
  );
}

/**
 * Sentinel for an explicitly-ungrouped component (`folder: null`). `stripKeys`
 * and `formatValue` both drop null object values, which would erase the
 * distinction between "ungrouped" and "unmanaged" and hide a group-membership
 * diff — so `null` is carried through as this sentinel and rewritten to a
 * literal `null` in the final output.
 */
export const FOLDER_UNGROUPED = "__FOLDER_UNGROUPED__";

/**
 * Returns a component reduced to a normalized, stably-ordered object: API-assigned
 * fields stripped, schema fields normalized and sorted by `pos`. Shared by
 * {@link serializeComponent} and field-level diffing.
 *
 * `component_group_uuid` is stripped by default (groups are a UI concern), but
 * kept when `includeGroupUuid` is set — used by diffing when a block opts into
 * the group escape hatch, so a changed group is detected and pushed.
 *
 * The transient `folder` key (slug path, or `null` for explicitly ungrouped) is
 * emitted when present so group membership diffs in slug-path space.
 */
export function cleanComponent(
  component: Record<string, unknown>,
  options: { includeGroupUuid?: boolean } = {},
): Record<string, unknown> {
  const stripSet = options.includeGroupUuid
    ? new Set([...COMPONENT_STRIP_KEYS].filter((key) => key !== "component_group_uuid"))
    : COMPONENT_STRIP_KEYS;
  const clean = stripKeys(component, stripSet);

  if (clean.schema && typeof clean.schema === "object") {
    clean.schema = normalizeSchemaFields(clean.schema as Record<string, Record<string, unknown>>);
  }

  // Enforce property order: name, display_name, is_root, is_nestable, folder, then rest, schema last
  const ordered: Record<string, unknown> = {};
  if (clean.name !== undefined) {
    ordered.name = clean.name;
  }
  if (clean.display_name !== undefined) {
    ordered.display_name = clean.display_name;
  }
  if (clean.is_root !== undefined) {
    ordered.is_root = clean.is_root;
  }
  if (clean.is_nestable !== undefined) {
    ordered.is_nestable = clean.is_nestable;
  }
  // Read `folder` from the original component: `stripKeys` already dropped a
  // `null` value, so `clean` can't be trusted for it.
  if ("folder" in component) {
    ordered.folder = component.folder === null ? FOLDER_UNGROUPED : component.folder;
  }

  const handled = new Set(["name", "display_name", "is_root", "is_nestable", "folder", "schema"]);
  for (const [key, value] of Object.entries(clean).sort(([a], [b]) => a.localeCompare(b))) {
    if (!handled.has(key)) {
      ordered[key] = value;
    }
  }

  if (clean.schema !== undefined) {
    ordered.schema = clean.schema;
  }

  return ordered;
}

export function serializeComponent(
  component: Record<string, unknown>,
  options: { includeGroupUuid?: boolean } = {},
): string {
  return `defineBlock(${formatValue(cleanComponent(component, options), 0)})`.replace(
    `folder: '${FOLDER_UNGROUPED}'`,
    "folder: null",
  );
}

/**
 * Returns a datasource reduced to a normalized, stably-ordered object (API-assigned
 * keys stripped). Shared by {@link serializeDatasource} and field-level diffing.
 */
export function cleanDatasource(datasource: Record<string, unknown>): Record<string, unknown> {
  const clean = stripKeys(datasource, DATASOURCE_STRIP_KEYS);

  if (Array.isArray(clean.dimensions)) {
    clean.dimensions = clean.dimensions.map((dim: unknown) =>
      typeof dim === "object" && dim !== null
        ? stripKeys(dim as Record<string, unknown>, DATASOURCE_DIMENSION_STRIP_KEYS)
        : dim,
    );
  }

  const ordered: Record<string, unknown> = {};
  if (clean.name !== undefined) {
    ordered.name = clean.name;
  }
  if (clean.slug !== undefined) {
    ordered.slug = clean.slug;
  }

  const handled = new Set(["name", "slug"]);
  for (const [key, value] of Object.entries(clean).sort(([a], [b]) => a.localeCompare(b))) {
    if (!handled.has(key)) {
      ordered[key] = value;
    }
  }

  return ordered;
}

/**
 * Serializes a datasource to a normalized `defineDatasource()` code string.
 */
export function serializeDatasource(datasource: Record<string, unknown>): string {
  return `defineDatasource(${formatValue(cleanDatasource(datasource), 0)})`;
}
