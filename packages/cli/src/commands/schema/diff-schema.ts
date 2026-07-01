import { createTwoFilesPatch } from 'diff';

import type { DiffResult, EntityDiff, RemoteSchemaData, SchemaData } from './types';
import { applyDefaults, COMPONENT_DEFAULTS, DATASOURCE_DEFAULTS, isRecord } from './utils';
import { serializeComponent, serializeDatasource } from './serialize';
import { buildGroupPathByUuid } from './folders';

type EntityType = 'component' | 'datasource';

/**
 * Deep-copies a component's `schema`, translating each field's
 * `component_group_whitelist` uuid entries to slug paths so both sides diff in
 * the same slug-path space. Applied symmetrically to remote (whose whitelist is
 * always uuids) and local (which may carry raw uuids when produced by
 * `schema init`; slug-path entries are not uuid keys in the map and pass
 * through unchanged). Unknown uuids are left as-is so they still produce a
 * visible diff. The source schema objects are never mutated.
 */
function translateGroupWhitelist(schema: unknown, uuidToPath: Map<string, string>): unknown {
  if (!isRecord(schema)) { return schema; }
  const result: Record<string, unknown> = {};
  for (const [fieldName, field] of Object.entries(schema)) {
    if (isRecord(field) && Array.isArray(field.component_group_whitelist)) {
      result[fieldName] = {
        ...field,
        component_group_whitelist: field.component_group_whitelist.map((entry: unknown) =>
          (typeof entry === 'string' ? uuidToPath.get(entry) ?? entry : entry)),
      };
    }
    else {
      result[fieldName] = field;
    }
  }
  return result;
}

function diffEntity(
  type: EntityType,
  name: string,
  localSerialized: string | null,
  remoteSerialized: string | null,
): EntityDiff {
  if (!remoteSerialized && localSerialized) {
    return { type, name, action: 'create', diff: null, local: null, remote: null };
  }
  if (remoteSerialized && !localSerialized) {
    return { type, name, action: 'stale', diff: null, local: null, remote: null };
  }
  if (localSerialized === remoteSerialized) {
    return { type, name, action: 'unchanged', diff: null, local: null, remote: null };
  }

  const patch = createTwoFilesPatch(
    `remote/${name}`,
    `local/${name}`,
    remoteSerialized!,
    localSerialized!,
    'remote',
    'local',
  );

  return { type, name, action: 'update', diff: patch, local: null, remote: null };
}

/** Diffs local schema against remote state and returns classified results. */
export function diffSchema(local: SchemaData, remote: RemoteSchemaData): DiffResult {
  const diffs: EntityDiff[] = [];

  // Build remote group path maps once. `buildGroupPathByUuid` returns slugified
  // segments per group uuid; join them into the same slug-path identity space
  // used by local folders and component `folder` keys.
  const groupPathByUuid = buildGroupPathByUuid([...remote.componentFolders.values()]);
  const uuidToPath = new Map<string, string>();
  for (const [uuid, segments] of groupPathByUuid) {
    uuidToPath.set(uuid, segments.join('/'));
  }
  const remoteFolderPaths = new Set(uuidToPath.values());

  // Diff folders (before components). Renames are unsupported, so a folder is
  // only ever `create`/`unchanged`/`stale` — display names matter at creation
  // only. `EntityDiff.name` carries the slug path.
  const localFolderPaths = new Set(local.folders.map(f => f.path));
  for (const folder of local.folders) {
    const action = remoteFolderPaths.has(folder.path) ? 'unchanged' : 'create';
    diffs.push({ type: 'folder', name: folder.path, action, diff: null, local: null, remote: null });
  }
  for (const path of remoteFolderPaths) {
    if (!localFolderPaths.has(path)) {
      diffs.push({ type: 'folder', name: path, action: 'stale', diff: null, local: null, remote: null });
    }
  }

  // Diff components
  const processedComponentNames = new Set<string>();
  for (const comp of local.components) {
    processedComponentNames.add(comp.name);
    const remoteComp = remote.components.get(comp.name);
    // Only diff the group UUID when the local block opts into the escape hatch;
    // otherwise it stays stripped on both sides so remote UI groups are left
    // untouched and no false diff is produced.
    const includeGroupUuid = typeof comp.component_group_uuid === 'string';

    // Shallow copies so group membership (`folder`) and whitelist path
    // translation never mutate the local schema or the remote component map.
    const localForDiff: Record<string, unknown> = { ...comp };
    const remoteForDiff: Record<string, unknown> | undefined = remoteComp ? { ...remoteComp } : undefined;

    // Group membership is only diffed when the local block manages it (a
    // `folder` key, string path or `null` for explicitly ungrouped). Synthesize
    // the remote block's `folder` from its group uuid so both sides diff in
    // slug-path space. Unmanaged blocks keep today's behavior: strip `folder`
    // from both sides so remote UI groups are left untouched.
    if ('folder' in comp) {
      if (remoteForDiff) {
        const uuid = remoteForDiff.component_group_uuid;
        remoteForDiff.folder = typeof uuid === 'string' && uuid ? uuidToPath.get(uuid) ?? null : null;
      }
    }
    else {
      delete localForDiff.folder;
      if (remoteForDiff) { delete remoteForDiff.folder; }
    }

    // Translate whitelist uuids → slug paths on both sides. `schema init` emits
    // raw uuid whitelists locally; without translating the local copy too, a
    // local uuid vs remote-translated path would diff dirty forever.
    localForDiff.schema = translateGroupWhitelist(localForDiff.schema, uuidToPath);
    if (remoteForDiff) {
      remoteForDiff.schema = translateGroupWhitelist(remoteForDiff.schema, uuidToPath);
    }

    const localSerialized = serializeComponent(applyDefaults(localForDiff, COMPONENT_DEFAULTS), { includeGroupUuid });
    const remoteSerialized = remoteForDiff
      ? serializeComponent(applyDefaults(remoteForDiff, COMPONENT_DEFAULTS), { includeGroupUuid })
      : null;
    diffs.push(diffEntity('component', comp.name, localSerialized, remoteSerialized));
  }
  for (const [name] of remote.components) {
    if (!processedComponentNames.has(name)) {
      diffs.push(diffEntity('component', name, null, 'stale'));
    }
  }

  // Diff datasources
  const processedDatasourceNames = new Set<string>();
  for (const ds of local.datasources) {
    processedDatasourceNames.add(ds.name);
    const remoteDs = remote.datasources.get(ds.name);
    const localSerialized = serializeDatasource(applyDefaults(ds, DATASOURCE_DEFAULTS));
    const remoteSerialized = remoteDs ? serializeDatasource(applyDefaults(remoteDs, DATASOURCE_DEFAULTS)) : null;
    diffs.push(diffEntity('datasource', ds.name, localSerialized, remoteSerialized));
  }
  for (const [name] of remote.datasources) {
    if (!processedDatasourceNames.has(name)) {
      diffs.push(diffEntity('datasource', name, null, 'stale'));
    }
  }

  return {
    diffs,
    creates: diffs.filter(d => d.action === 'create').length,
    updates: diffs.filter(d => d.action === 'update').length,
    unchanged: diffs.filter(d => d.action === 'unchanged').length,
    stale: diffs.filter(d => d.action === 'stale').length,
  };
}
