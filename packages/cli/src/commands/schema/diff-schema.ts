import type { Component, Datasource } from '../../types';
import type { DiffResult, EntityDiff, FieldChange, LocalFolder, NormalizedSchema } from './types';
import { applyDefaults, COMPONENT_DEFAULTS, DATASOURCE_DEFAULTS, formatValue, isRecord } from './utils';
import { cleanComponent, cleanDatasource } from './serialize';
import { mapSchemaGroupLists } from './folders';
import { mapSchemaTagLists } from './tags';

type EntityType = 'component' | 'datasource';

/**
 * Translates one side's references into the shared identity space both sides are
 * compared in: component group uuids into slug paths, block tag ids into names.
 */
interface NameSpace {
  group: (uuid: string) => string;
  tag: (entry: string | number) => string | number;
}

/**
 * Resolves through a side's own map first, then the other side's. A schema
 * written in code carries no map of its own, so a raw uuid or tag id it holds —
 * what `schema init` emits — resolves against the space it is diffed with
 * instead of diffing dirty forever. An entry neither side knows is left as-is so
 * it still produces a visible diff.
 */
function nameSpaceFor(own: NormalizedSchema, other: NormalizedSchema): NameSpace {
  return {
    group: uuid => own.groupPathByUuid.get(uuid) ?? other.groupPathByUuid.get(uuid) ?? uuid,
    tag: (entry) => {
      const id = String(entry);
      return own.tagNameById.get(id) ?? other.tagNameById.get(id) ?? entry;
    },
  };
}

/** Normalizes a raw `internal_tag_ids` list to strings, leaving a non-list value untouched. */
function stringifyTagIds(internalTagIds: unknown): unknown {
  if (!Array.isArray(internalTagIds)) {
    return internalTagIds;
  }
  return internalTagIds.map(id => (typeof id === 'number' ? String(id) : id));
}

/**
 * A block's tag membership as sorted names: its own `tags` when it manages them
 * by name, otherwise its `internal_tag_ids` resolved through `names`. Tag order
 * is not meaningful to Storyblok and the API does not preserve the order a push
 * sent, so both sides are sorted rather than reporting a reordering as a change.
 */
function tagNames(comp: Record<string, unknown>, names: NameSpace): string[] {
  if (Array.isArray(comp.tags)) {
    return [...comp.tags].map(String).sort();
  }
  if (!Array.isArray(comp.internal_tag_ids)) {
    return [];
  }
  return comp.internal_tag_ids.map(id => String(names.tag(id))).sort();
}

/**
 * Rewrites one side of a component into the shared identity space before it is
 * cleaned and compared. Group and tag lists inside `schema` are translated on
 * both sides; tag membership diffs by name only when the target block manages it
 * that way (`byTagName`), and otherwise falls back to comparing raw
 * `internal_tag_ids` as strings — the component serializer returns tag ids as
 * strings while a hand-written schema usually holds the numbers it was pasted
 * from, and an id that is already correct must not report the block as changed
 * on every push. The source component is never mutated.
 */
function toNameSpace(comp: Component, names: NameSpace, byTagName: boolean): Record<string, unknown> {
  const prepared: Record<string, unknown> = { ...comp };

  if (byTagName) {
    prepared.tags = tagNames(prepared, names);
    delete prepared.internal_tag_ids;
  }
  else {
    delete prepared.tags;
    if ('internal_tag_ids' in prepared) {
      prepared.internal_tag_ids = stringifyTagIds(prepared.internal_tag_ids);
    }
  }

  if ('schema' in prepared) {
    prepared.schema = mapSchemaGroupLists(prepared.schema, names.group);
    prepared.schema = mapSchemaTagLists(prepared.schema, names.tag);
  }

  return prepared;
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
      changes.push({ field, change: 'removed', before: before[field] });
    }
    else if (!inBefore && inAfter) {
      changes.push({ field, change: 'added', after: after[field] });
    }
    else if (canonical(before[field]) !== canonical(after[field])) {
      changes.push({ field, change: 'modified', before: before[field], after: after[field] });
    }
  }

  return changes;
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

/**
 * Field-level changes for a component: top-level props (display_name, is_nestable,
 * component_group_uuid, …) and, expanded one level, individual schema fields.
 */
function componentChanges(before: Record<string, unknown>, after: Record<string, unknown>): FieldChange[] {
  const { schema: beforeSchema, ...beforeProps } = before;
  const { schema: afterSchema, ...afterProps } = after;
  return [
    ...diffKeyed(beforeProps, afterProps),
    ...diffKeyed(asRecord(beforeSchema), asRecord(afterSchema)),
  ];
}

/** Builds an {@link EntityDiff} from the cleaned source/target objects. */
function buildEntityDiff(
  type: EntityType,
  name: string,
  fromRaw: Record<string, unknown> | null,
  toRaw: Record<string, unknown> | null,
  fromClean: Record<string, unknown> | null,
  toClean: Record<string, unknown> | null,
): EntityDiff {
  if (!fromClean && toClean) {
    return { type, name, action: 'create', changes: [], before: null, after: toRaw };
  }
  if (fromClean && !toClean) {
    return { type, name, action: 'stale', changes: [], before: fromRaw, after: null };
  }
  if (canonical(fromClean) === canonical(toClean)) {
    return { type, name, action: 'unchanged', changes: [], before: fromRaw, after: toRaw };
  }

  const changes = type === 'component'
    ? componentChanges(fromClean!, toClean!)
    : diffKeyed(fromClean!, toClean!);

  return { type, name, action: 'update', changes, before: fromRaw, after: toRaw };
}

/** Names of `to` in insertion order, then any `from`-only names — mirrors the target's order. */
function orderedNames<T>(from: Map<string, T>, to: Map<string, T>): string[] {
  const names = [...to.keys()];
  for (const name of from.keys()) {
    if (!to.has(name)) { names.push(name); }
  }
  return names;
}

function diffComponent(
  name: string,
  fromComp: Component | undefined,
  toComp: Component | undefined,
  fromNames: NameSpace,
  toNames: NameSpace,
): EntityDiff {
  // Only diff the group UUID when the target block opts into the escape hatch;
  // otherwise it stays stripped on both sides so no false diff is produced.
  const includeGroupUuid = typeof toComp?.component_group_uuid === 'string';
  // Likewise for tag membership: a target block carrying a `tags` key manages it
  // by name, so both sides are compared in name space.
  const byTagName = toComp ? 'tags' in toComp : false;
  const fromClean = fromComp
    ? cleanComponent(applyDefaults(toNameSpace(fromComp, fromNames, byTagName), COMPONENT_DEFAULTS), { includeGroupUuid })
    : null;
  const toClean = toComp
    ? cleanComponent(applyDefaults(toNameSpace(toComp, toNames, byTagName), COMPONENT_DEFAULTS), { includeGroupUuid })
    : null;
  return buildEntityDiff('component', name, fromComp ?? null, toComp ?? null, fromClean, toClean);
}

function diffDatasource(name: string, fromDs: Datasource | undefined, toDs: Datasource | undefined): EntityDiff {
  const fromClean = fromDs ? cleanDatasource(applyDefaults(fromDs, DATASOURCE_DEFAULTS)) : null;
  const toClean = toDs ? cleanDatasource(applyDefaults(toDs, DATASOURCE_DEFAULTS)) : null;
  return buildEntityDiff('datasource', name, fromDs ?? null, toDs ?? null, fromClean, toClean);
}

/**
 * Folders (component groups) are identified by slug path. Renames are
 * unsupported, so a folder is only ever `create` (target-only), `stale`
 * (source-only), or `unchanged` — display names matter at creation only, and
 * there are no field-level changes. {@link EntityDiff.name} carries the path.
 */
function diffFolder(name: string, fromFolder: LocalFolder | undefined, toFolder: LocalFolder | undefined): EntityDiff {
  const before = fromFolder ? { ...fromFolder } : null;
  const after = toFolder ? { ...toFolder } : null;
  const action = !fromFolder && toFolder
    ? 'create'
    : fromFolder && !toFolder
      ? 'stale'
      : 'unchanged';
  return { type: 'folder', name, action, changes: [], before, after };
}

/**
 * Diffs two normalized schemas and returns classified results describing how to
 * get from `from` (base) to `to` (target): entities only in `to` are `create`,
 * only in `from` are `stale`, in both and differing are `update` (with
 * field-level `changes`), otherwise `unchanged`.
 *
 * Folders (component groups) are diffed by slug path. A block's group
 * membership is only diffed when the target block opts into the escape hatch by
 * setting `component_group_uuid` explicitly. Group and tag references inside a
 * block are compared in name space, not in the id space the API uses.
 */
export function diffSchema(from: NormalizedSchema, to: NormalizedSchema): DiffResult {
  const diffs: EntityDiff[] = [];

  // Folders first: `schema push` creates them parent-first before the blocks
  // that reference them.
  for (const name of orderedNames(from.folders, to.folders)) {
    diffs.push(diffFolder(name, from.folders.get(name), to.folders.get(name)));
  }

  const fromNames = nameSpaceFor(from, to);
  const toNames = nameSpaceFor(to, from);
  for (const name of orderedNames(from.components, to.components)) {
    diffs.push(diffComponent(name, from.components.get(name), to.components.get(name), fromNames, toNames));
  }

  for (const name of orderedNames(from.datasources, to.datasources)) {
    diffs.push(diffDatasource(name, from.datasources.get(name), to.datasources.get(name)));
  }

  return {
    diffs,
    creates: diffs.filter(d => d.action === 'create').length,
    updates: diffs.filter(d => d.action === 'update').length,
    unchanged: diffs.filter(d => d.action === 'unchanged').length,
    stale: diffs.filter(d => d.action === 'stale').length,
  };
}
