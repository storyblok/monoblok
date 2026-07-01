import type { Component, Datasource } from '../../types';
import type { DiffResult, EntityDiff, FieldChange, NormalizedSchema } from './types';
import { applyDefaults, COMPONENT_DEFAULTS, DATASOURCE_DEFAULTS, formatValue, isRecord } from './utils';
import { cleanComponent, cleanDatasource } from './serialize';

type EntityType = 'component' | 'datasource';

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

function diffComponent(name: string, fromComp: Component | undefined, toComp: Component | undefined): EntityDiff {
  // Only diff the group UUID when the target block opts into the escape hatch;
  // otherwise it stays stripped on both sides so no false diff is produced.
  const includeGroupUuid = typeof toComp?.component_group_uuid === 'string';
  const fromClean = fromComp
    ? cleanComponent(applyDefaults(fromComp, COMPONENT_DEFAULTS), { includeGroupUuid })
    : null;
  const toClean = toComp
    ? cleanComponent(applyDefaults(toComp, COMPONENT_DEFAULTS), { includeGroupUuid })
    : null;
  return buildEntityDiff('component', name, fromComp ?? null, toComp ?? null, fromClean, toClean);
}

function diffDatasource(name: string, fromDs: Datasource | undefined, toDs: Datasource | undefined): EntityDiff {
  const fromClean = fromDs ? cleanDatasource(applyDefaults(fromDs, DATASOURCE_DEFAULTS)) : null;
  const toClean = toDs ? cleanDatasource(applyDefaults(toDs, DATASOURCE_DEFAULTS)) : null;
  return buildEntityDiff('datasource', name, fromDs ?? null, toDs ?? null, fromClean, toClean);
}

/**
 * Diffs two normalized schemas and returns classified results describing how to
 * get from `from` (base) to `to` (target): entities only in `to` are `create`,
 * only in `from` are `stale`, in both and differing are `update` (with
 * field-level `changes`), otherwise `unchanged`.
 *
 * Component groups are not diffed unless the target block opts into the escape
 * hatch by setting `component_group_uuid` explicitly.
 */
export function diffSchema(from: NormalizedSchema, to: NormalizedSchema): DiffResult {
  const diffs: EntityDiff[] = [];

  for (const name of orderedNames(from.components, to.components)) {
    diffs.push(diffComponent(name, from.components.get(name), to.components.get(name)));
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
