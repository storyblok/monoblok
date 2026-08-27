import type { Component, Datasource } from "../../types";
import type { DiffResult, EntityDiff, FieldChange, LocalFolder, NormalizedSchema } from "./types";
import {
  applyDefaults,
  COMPONENT_DEFAULTS,
  DATASOURCE_DEFAULTS,
  formatValue,
  isRecord,
} from "./utils";
import { cleanComponent, cleanDatasource } from "./serialize";

type EntityType = "component" | "datasource";

/** Canonical string for deep value equality; `formatValue` sorts keys recursively. */
function canonical(value: unknown): string {
  return formatValue(value, 0);
}

/**
 * Classifies field-level changes between two name-keyed objects. A key present on
 * only one side is `added`/`removed`; a key on both whose canonical form differs
 * is `modified`. Keys are compared in stable alphabetical order.
 */
function diffKeyed(before: Record<string, unknown>, after: Record<string, unknown>): FieldChange[] {
  const changes: FieldChange[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const field of [...keys].sort()) {
    const inBefore = field in before;
    const inAfter = field in after;
    if (inBefore && !inAfter) {
      changes.push({ field, change: "removed", before: before[field] });
    } else if (!inBefore && inAfter) {
      changes.push({ field, change: "added", after: after[field] });
    } else if (canonical(before[field]) !== canonical(after[field])) {
      changes.push({ field, change: "modified", before: before[field], after: after[field] });
    }
  }

  return changes;
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

/**
 * Like {@link diffKeyed}, but recurses into nested records so a change reads as
 * the property that actually moved (`schema.body.maximum`) instead of two dumps
 * of the whole enclosing object. Recursion stops at non-record values, which are
 * reported whole.
 */
function diffKeyedDeep(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  prefix: string,
): FieldChange[] {
  const changes: FieldChange[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of [...keys].sort()) {
    const field = `${prefix}${key}`;
    const inBefore = key in before;
    const inAfter = key in after;
    if (inBefore && !inAfter) {
      changes.push({ field, change: "removed", before: before[key] });
    } else if (!inBefore && inAfter) {
      changes.push({ field, change: "added", after: after[key] });
    } else if (canonical(before[key]) !== canonical(after[key])) {
      if (isRecord(before[key]) && isRecord(after[key])) {
        changes.push(...diffKeyedDeep(before[key], after[key], `${field}.`));
      } else {
        changes.push({ field, change: "modified", before: before[key], after: after[key] });
      }
    }
  }

  return changes;
}

/**
 * Field-level changes for a component: top-level props (display_name, is_nestable,
 * component_group_uuid, …) plus schema fields, which are namespaced under
 * `schema.` and expanded down to the individual property that changed. The
 * namespace keeps a schema field named e.g. `folder` distinct from the top-level
 * `folder` prop.
 */
function componentChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldChange[] {
  const { schema: beforeSchema, ...beforeProps } = before;
  const { schema: afterSchema, ...afterProps } = after;
  return [
    ...diffKeyed(beforeProps, afterProps),
    ...diffKeyedDeep(asRecord(beforeSchema), asRecord(afterSchema), "schema."),
  ];
}

/**
 * Builds an {@link EntityDiff} from the cleaned source/target objects. `before`
 * and `after` carry the cleaned forms — API-assigned ids, timestamps and
 * per-space group uuids are already stripped, so the payload is safe to replay
 * into another space. An `unchanged` entity carries neither, since both sides
 * are by definition identical.
 */
function buildEntityDiff(
  type: EntityType,
  name: string,
  fromClean: Record<string, unknown> | null,
  toClean: Record<string, unknown> | null,
): EntityDiff {
  if (!fromClean && toClean) {
    return { type, name, action: "create", changes: [], before: null, after: toClean };
  }
  if (fromClean && !toClean) {
    return { type, name, action: "stale", changes: [], before: fromClean, after: null };
  }
  if (canonical(fromClean) === canonical(toClean)) {
    return { type, name, action: "unchanged", changes: [], before: null, after: null };
  }

  const changes =
    type === "component" ? componentChanges(fromClean!, toClean!) : diffKeyed(fromClean!, toClean!);

  return { type, name, action: "update", changes, before: fromClean, after: toClean };
}

/** Names of `to` in insertion order, then any `from`-only names — mirrors the target's order. */
function orderedNames<T>(from: Map<string, T>, to: Map<string, T>): string[] {
  const names = [...to.keys()];
  for (const name of from.keys()) {
    if (!to.has(name)) {
      names.push(name);
    }
  }
  return names;
}

/**
 * Whether a side can express this block's group membership: a schema read from a
 * space always can (membership lives in `component_group_uuid`), and a local
 * block does so by declaring a `folder` key. When either side cannot, membership
 * is unmanaged and `folder` is stripped from both, leaving the remote UI grouping
 * untouched instead of reporting a phantom change.
 */
function managesFolder(comp: Component | undefined, schema: NormalizedSchema): boolean {
  return comp !== undefined && (schema.groupPathByUuid !== undefined || "folder" in comp);
}

/**
 * Copies a component into slug-path identity space: group membership as a
 * `folder` key (synthesized from `component_group_uuid` for a space-read block)
 * and each field's `component_group_whitelist` uuids translated to paths. Both
 * sides go through this so a uuid never diffs against the path meaning the same
 * group. The source objects are never mutated.
 */
function toPathSpace(
  comp: Component,
  uuidToPath: Map<string, string>,
  manageFolder: boolean,
): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...comp };

  if (manageFolder) {
    if (!("folder" in copy)) {
      const uuid = copy.component_group_uuid;
      copy.folder = typeof uuid === "string" && uuid ? (uuidToPath.get(uuid) ?? null) : null;
    }
  } else {
    delete copy.folder;
  }

  if (isRecord(copy.schema)) {
    const schema: Record<string, unknown> = {};
    for (const [fieldName, field] of Object.entries(copy.schema)) {
      // Unknown uuids pass through untranslated so they still surface as a diff.
      schema[fieldName] =
        isRecord(field) && Array.isArray(field.component_group_whitelist)
          ? {
              ...field,
              component_group_whitelist: field.component_group_whitelist.map((entry: unknown) =>
                typeof entry === "string" ? (uuidToPath.get(entry) ?? entry) : entry,
              ),
            }
          : field;
    }
    copy.schema = schema;
  }

  return copy;
}

function diffComponent(
  name: string,
  fromComp: Component | undefined,
  toComp: Component | undefined,
  context: { uuidToPath: Map<string, string>; from: NormalizedSchema; to: NormalizedSchema },
  compareGroupUuid: boolean,
): EntityDiff {
  const { uuidToPath, from, to } = context;
  // Group UUIDs are per-space identifiers, so they only carry meaning when the
  // caller opts in (push, where the target is the local DSL and an explicit
  // `component_group_uuid` is a deliberate escape hatch). When comparing two
  // spaces they never match and would flag every grouped block as changed, so
  // the field stays stripped on both sides unless both are opted in.
  const includeGroupUuid = compareGroupUuid && typeof toComp?.component_group_uuid === "string";
  const manageFolder = managesFolder(fromComp, from) && managesFolder(toComp, to);
  const fromClean = fromComp
    ? cleanComponent(
        applyDefaults(toPathSpace(fromComp, uuidToPath, manageFolder), COMPONENT_DEFAULTS),
        {
          includeGroupUuid,
        },
      )
    : null;
  const toClean = toComp
    ? cleanComponent(
        applyDefaults(toPathSpace(toComp, uuidToPath, manageFolder), COMPONENT_DEFAULTS),
        {
          includeGroupUuid,
        },
      )
    : null;
  return buildEntityDiff("component", name, fromClean, toClean);
}

function diffDatasource(
  name: string,
  fromDs: Datasource | undefined,
  toDs: Datasource | undefined,
): EntityDiff {
  const fromClean = fromDs ? cleanDatasource(applyDefaults(fromDs, DATASOURCE_DEFAULTS)) : null;
  const toClean = toDs ? cleanDatasource(applyDefaults(toDs, DATASOURCE_DEFAULTS)) : null;
  return buildEntityDiff("datasource", name, fromClean, toClean);
}

/**
 * Folders (component groups) are identified by slug path. Renames are
 * unsupported, so a folder is only ever `create` (target-only), `stale`
 * (source-only), or `unchanged` — display names matter at creation only, and
 * there are no field-level changes. {@link EntityDiff.name} carries the path.
 */
function diffFolder(
  name: string,
  fromFolder: LocalFolder | undefined,
  toFolder: LocalFolder | undefined,
): EntityDiff {
  const action =
    !fromFolder && toFolder ? "create" : fromFolder && !toFolder ? "stale" : "unchanged";
  // An unchanged folder carries neither side, matching the entity invariant:
  // both are identical, so neither tells a consumer anything.
  return {
    type: "folder",
    name,
    action,
    changes: [],
    before: action === "unchanged" || !fromFolder ? null : { ...fromFolder },
    after: action === "unchanged" || !toFolder ? null : { ...toFolder },
  };
}

/**
 * Diffs two normalized schemas and returns classified results describing how to
 * get from `from` (base) to `to` (target): entities only in `to` are `create`,
 * only in `from` are `stale`, in both and differing are `update` (with
 * field-level `changes`), otherwise `unchanged`.
 *
 * Folders (component groups) are diffed by slug path. Component group UUIDs are
 * ignored by default (they are per-space identifiers); set `compareGroupUuid`
 * when the target is a local DSL, so a block that sets `component_group_uuid`
 * explicitly opts into having its group membership diffed and pushed.
 */
export function diffSchema(
  from: NormalizedSchema,
  to: NormalizedSchema,
  options: { compareGroupUuid?: boolean } = {},
): DiffResult {
  const compareGroupUuid = options.compareGroupUuid ?? false;
  const diffs: EntityDiff[] = [];

  // One translation table for both sides. Group uuids are globally unique, so a
  // union is unambiguous, and it lets a local block that still carries raw uuids
  // (as `schema init` emits) resolve against the space it was pulled from.
  const uuidToPath = new Map<string, string>([
    ...(from.groupPathByUuid ?? new Map<string, string>()),
    ...(to.groupPathByUuid ?? new Map<string, string>()),
  ]);
  const context = { uuidToPath, from, to };

  // Folders first: `schema push` creates them parent-first before the blocks
  // that reference them.
  for (const name of orderedNames(from.folders, to.folders)) {
    diffs.push(diffFolder(name, from.folders.get(name), to.folders.get(name)));
  }

  for (const name of orderedNames(from.components, to.components)) {
    diffs.push(
      diffComponent(
        name,
        from.components.get(name),
        to.components.get(name),
        context,
        compareGroupUuid,
      ),
    );
  }

  for (const name of orderedNames(from.datasources, to.datasources)) {
    diffs.push(diffDatasource(name, from.datasources.get(name), to.datasources.get(name)));
  }

  return {
    diffs,
    creates: diffs.filter((d) => d.action === "create").length,
    updates: diffs.filter((d) => d.action === "update").length,
    unchanged: diffs.filter((d) => d.action === "unchanged").length,
    stale: diffs.filter((d) => d.action === "stale").length,
  };
}
