import type { Component, Datasource } from "../../types";
import type { DiffResult, EntityDiff, FieldChange, LocalFolder, NormalizedSchema } from "./types";
import {
  applyDefaults,
  COMPONENT_DEFAULTS,
  DATASOURCE_DEFAULTS,
  formatValue,
  isRecord,
} from "./utils";
import { cleanComponent, cleanDatasource, FOLDER_UNGROUPED } from "./serialize";
import { mapSchemaGroupLists } from "./folders";
import { mapSchemaTagLists } from "./tags";

type EntityType = "component" | "datasource";

/**
 * Resolves a block tag id to its name. Tag ids are per-space, so both sides are
 * translated into name space before comparing; an id neither side knows is left
 * as-is so it still surfaces as a diff.
 */
type ResolveTag = (entry: string | number) => string | number;

function resolveTagWith(own: NormalizedSchema, other: NormalizedSchema): ResolveTag {
  return (entry) => {
    const id = String(entry);
    return own.tagNameById?.get(id) ?? other.tagNameById?.get(id) ?? entry;
  };
}

/** Normalizes a raw `internal_tag_ids` list to strings, leaving a non-list value untouched. */
function stringifyTagIds(internalTagIds: unknown): unknown {
  if (!Array.isArray(internalTagIds)) {
    return internalTagIds;
  }
  return internalTagIds.map((id) => (typeof id === "number" ? String(id) : id));
}

/**
 * A block's tag membership as sorted names: its own `tags` when it declares them
 * that way, otherwise its `internal_tag_ids` resolved through `resolveTag`. Tag
 * order is not meaningful to Storyblok and the API does not preserve the order a
 * push sent, so both sides are sorted rather than reporting a reordering as a
 * change.
 */
function tagNames(comp: Record<string, unknown>, resolveTag: ResolveTag): string[] {
  if (Array.isArray(comp.tags)) {
    return [...comp.tags].map(String).sort();
  }
  if (!Array.isArray(comp.internal_tag_ids)) {
    return [];
  }
  return comp.internal_tag_ids.map((id) => String(resolveTag(id))).sort();
}

/**
 * Copies a component into tag-name identity space: its own membership as a
 * `tags` key when the target block declares one (`byTagName`), and each field's
 * tag list ids translated to names. Without `byTagName` the raw-id escape hatch
 * diffs in id space instead, where the two sides disagree on the JavaScript
 * type — the component serializer returns tag ids as strings while a
 * hand-written schema usually holds the numbers it was pasted from — so they are
 * compared as strings. The source objects are never mutated.
 */
function toTagSpace(
  comp: Component,
  resolveTag: ResolveTag,
  byTagName: boolean,
): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...comp };

  if (byTagName) {
    copy.tags = tagNames(copy, resolveTag);
    delete copy.internal_tag_ids;
  } else {
    delete copy.tags;
    if ("internal_tag_ids" in copy) {
      copy.internal_tag_ids = stringifyTagIds(copy.internal_tag_ids);
    }
  }

  if (isRecord(copy.schema)) {
    copy.schema = mapSchemaTagLists(copy.schema, resolveTag);
  }

  return copy;
}

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
 * An array that is really a set keyed by `name` — datasource dimensions — as a
 * name-keyed record, so a change reads as the member that moved
 * rather than two dumps of the whole list, and reordering alone is not a change.
 * Returns `null` for any other array shape, including one whose duplicate names
 * would make the mapping lossy.
 */
function asNameKeyed(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const keyed: Record<string, unknown> = {};
  for (const item of value) {
    if (!isRecord(item) || typeof item.name !== "string" || item.name in keyed) {
      return null;
    }
    keyed[item.name] = item;
  }
  return keyed;
}

/**
 * Like {@link diffKeyed}, but recurses into nested records so a change reads as
 * the property that actually moved (`schema.body.maximum`) instead of two dumps
 * of the whole enclosing object. Name-keyed arrays are recursed into the same
 * way (`dimensions.fr.entry_value`); every other non-record value is reported
 * whole.
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
      const beforeKeyed = asNameKeyed(before[key]);
      const afterKeyed = asNameKeyed(after[key]);
      if (isRecord(before[key]) && isRecord(after[key])) {
        changes.push(...diffKeyedDeep(before[key], after[key], `${field}.`));
      } else if (beforeKeyed && afterKeyed) {
        // Two name-keyed lists can differ while no entry does — they were
        // reordered. Report the field whole then, so a change is never listed
        // without saying what it was.
        const entryChanges = diffKeyedDeep(beforeKeyed, afterKeyed, `${field}.`);
        changes.push(
          ...(entryChanges.length > 0
            ? entryChanges
            : [{ field, change: "modified", before: before[key], after: after[key] } as const]),
        );
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
 * `cleanComponent` marks an explicitly ungrouped block with a sentinel, because
 * a literal `null` would be dropped by the canonical form and become
 * indistinguishable from a block that does not manage its group at all. Once the
 * comparison is done the distinction is carried by the diff itself, so the
 * sentinel is resolved back to the `null` the user wrote before it reaches
 * either the rendered output or the report payload.
 */
function resolveFolderSentinel(
  entity: Record<string, unknown> | null,
): Record<string, unknown> | null {
  return entity?.folder === FOLDER_UNGROUPED ? { ...entity, folder: null } : entity;
}

function resolveFolderSentinelInChange(change: FieldChange): FieldChange {
  if (change.field !== "folder") {
    return change;
  }
  const resolved = { ...change };
  if (resolved.before === FOLDER_UNGROUPED) {
    resolved.before = null;
  }
  if (resolved.after === FOLDER_UNGROUPED) {
    resolved.after = null;
  }
  return resolved;
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
    return {
      type,
      name,
      action: "create",
      changes: [],
      before: null,
      after: resolveFolderSentinel(toClean),
    };
  }
  if (fromClean && !toClean) {
    return {
      type,
      name,
      action: "stale",
      changes: [],
      before: resolveFolderSentinel(fromClean),
      after: null,
    };
  }
  if (canonical(fromClean) === canonical(toClean)) {
    return { type, name, action: "unchanged", changes: [], before: null, after: null };
  }

  const changes =
    type === "component"
      ? componentChanges(fromClean!, toClean!)
      : diffKeyedDeep(fromClean!, toClean!, "");

  return {
    type,
    name,
    action: "update",
    changes: changes.map(resolveFolderSentinelInChange),
    before: resolveFolderSentinel(fromClean),
    after: resolveFolderSentinel(toClean),
  };
}

/**
 * Every name across both sides, sorted, so a diff reads in one order regardless
 * of which order the API happened to return entities in and an entity only on
 * the base side sits next to its neighbours instead of after every other one.
 *
 * Code-unit order (not `localeCompare`) because folder paths must stay
 * parent-first for `schema push`, which creates a group before the groups nested
 * in it. A parent path is a prefix of its children, so it always compares lower.
 */
function orderedNames<T>(from: Map<string, T>, to: Map<string, T>): string[] {
  return [...new Set([...to.keys(), ...from.keys()])].sort();
}

/**
 * Whether a side can express this block's group membership: a schema read from a
 * space always can (membership lives in `component_group_uuid`), and a local
 * block does so by declaring a `folder` key. When a side that holds the block
 * cannot, membership is unmanaged and `folder` is stripped, leaving the remote UI
 * grouping untouched instead of reporting a phantom change.
 *
 * A side that does not hold the block at all imposes no constraint. Requiring it
 * to would strip `folder` from every `create` and `stale` entity, so a diff would
 * report a new block and the folder it belongs in without saying they go
 * together — and replaying it would land the block ungrouped.
 */
function canExpressFolder(comp: Component | undefined, schema: NormalizedSchema): boolean {
  return comp === undefined || schema.groupPathByUuid !== undefined || "folder" in comp;
}

/**
 * Whether either side actually places this block in a group. Group membership
 * that goes uncompared is only worth reporting when there is membership to
 * report: a block ungrouped everywhere loses nothing by not being compared.
 *
 * Both spellings count. A block read from a space carries
 * `component_group_uuid`, and a block written in code declares `folder` — so
 * checking only the former would stay silent when the membership that goes
 * uncompared is the one a schema file declares.
 */
function hasGroupMembership(
  fromComp: Component | undefined,
  toComp: Component | undefined,
): boolean {
  return [fromComp, toComp].some((comp) => {
    if (comp === undefined) {
      return false;
    }
    const uuid = comp.component_group_uuid;
    const folder = (comp as Record<string, unknown>).folder;
    return (
      (typeof uuid === "string" && uuid !== "") || (typeof folder === "string" && folder !== "")
    );
  });
}

/**
 * Whether a block's own tag membership is compared as names rather than as raw
 * ids. A block written in code opts in by declaring a `tags` key, on whichever
 * side it sits: the comparison is symmetric, so which source is the base must
 * not change what a tag means.
 *
 * Otherwise it is enough that one side can name the ids, since each side
 * resolves through the other's table as well. A block read from a space carries
 * `internal_tag_ids` and no `tags` key, so without this a space's tags would be
 * reported as the bare per-space numbers a user cannot act on — against another
 * space, and against a schema file that simply does not mention tags.
 *
 * A block that manages its tags by raw id, against a side that cannot resolve
 * ids, keeps diffing `internal_tag_ids` — the same-space escape hatch.
 */
function comparesTagsByName(
  fromComp: Component | undefined,
  toComp: Component | undefined,
  from: NormalizedSchema,
  to: NormalizedSchema,
): boolean {
  if ((toComp && "tags" in toComp) || (fromComp && "tags" in fromComp)) {
    return true;
  }
  return (
    fromComp !== undefined &&
    toComp !== undefined &&
    (from.tagNameById !== undefined || to.tagNameById !== undefined)
  );
}

/**
 * Copies a component into slug-path identity space: group membership as a
 * `folder` key (synthesized from `component_group_uuid` for a space-read block)
 * and each field's group list uuids translated to paths. Both sides go through
 * this so a uuid never diffs against the path meaning the same group. The
 * source objects are never mutated.
 */
function toPathSpace(
  comp: Record<string, unknown>,
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

  // Unknown uuids pass through untranslated so they still surface as a diff.
  copy.schema = mapSchemaGroupLists(copy.schema, (entry) => uuidToPath.get(entry) ?? entry);

  return copy;
}

function diffComponent(
  name: string,
  fromComp: Component | undefined,
  toComp: Component | undefined,
  context: {
    uuidToPath: Map<string, string>;
    fromTag: ResolveTag;
    toTag: ResolveTag;
    from: NormalizedSchema;
    to: NormalizedSchema;
  },
  compareGroupUuid: boolean,
  manageFolder: boolean,
): EntityDiff {
  const { uuidToPath, fromTag, toTag } = context;
  // Group UUIDs are per-space identifiers, so they only carry meaning when the
  // caller opts in (push, where the target is the local DSL and an explicit
  // `component_group_uuid` is a deliberate escape hatch). When comparing two
  // spaces they never match and would flag every grouped block as changed, so
  // the field stays stripped on both sides unless both are opted in.
  const includeGroupUuid = compareGroupUuid && typeof toComp?.component_group_uuid === "string";
  const byTagName = comparesTagsByName(fromComp, toComp, context.from, context.to);
  const fromClean = fromComp
    ? cleanComponent(
        applyDefaults(
          toPathSpace(toTagSpace(fromComp, fromTag, byTagName), uuidToPath, manageFolder),
          COMPONENT_DEFAULTS,
        ),
        { includeGroupUuid },
      )
    : null;
  const toClean = toComp
    ? cleanComponent(
        applyDefaults(
          toPathSpace(toTagSpace(toComp, toTag, byTagName), uuidToPath, manageFolder),
          COMPONENT_DEFAULTS,
        ),
        { includeGroupUuid },
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
 *
 * A block's group and tag references are compared in name space rather than the
 * id space the API uses: group lists always, and tag lists always, while its own
 * tag membership does so unless a side is diffing by raw id (see
 * {@link comparesTagsByName}).
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
  // Tag ids, unlike group uuids, are only unique within a space, so each side
  // resolves through its own table and falls back to the other's — which is what
  // lets a local block holding raw ids (as `schema init` emits) resolve against
  // the space it was pulled from.
  const context = {
    uuidToPath,
    fromTag: resolveTagWith(from, to),
    toTag: resolveTagWith(to, from),
    from,
    to,
  };

  // Folders first: `schema push` creates them parent-first before the blocks
  // that reference them.
  for (const name of orderedNames(from.folders, to.folders)) {
    diffs.push(diffFolder(name, from.folders.get(name), to.folders.get(name)));
  }

  const unmanagedFolders: string[] = [];
  for (const name of orderedNames(from.components, to.components)) {
    const fromComp = from.components.get(name);
    const toComp = to.components.get(name);
    const manageFolder = canExpressFolder(fromComp, from) && canExpressFolder(toComp, to);
    if (!manageFolder && hasGroupMembership(fromComp, toComp)) {
      unmanagedFolders.push(name);
    }
    diffs.push(diffComponent(name, fromComp, toComp, context, compareGroupUuid, manageFolder));
  }

  for (const name of orderedNames(from.datasources, to.datasources)) {
    diffs.push(diffDatasource(name, from.datasources.get(name), to.datasources.get(name)));
  }

  return {
    diffs,
    unmanagedFolders,
    creates: diffs.filter((d) => d.action === "create").length,
    updates: diffs.filter((d) => d.action === "update").length,
    unchanged: diffs.filter((d) => d.action === "unchanged").length,
    stale: diffs.filter((d) => d.action === "stale").length,
  };
}
