import { createTwoFilesPatch } from 'diff';

import type { DiffResult, EntityDiff, RemoteSchemaData, SchemaData } from '../types';
import { applyDefaults, COMPONENT_DEFAULTS, DATASOURCE_DEFAULTS } from '../utils';
import { serializeComponent, serializeDatasource } from '../serialize';

type EntityType = 'component' | 'datasource';

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

  // Diff components
  const processedComponentNames = new Set<string>();
  for (const comp of local.components) {
    processedComponentNames.add(comp.name);
    const remoteComp = remote.components.get(comp.name);
    // Only diff the group UUID when the local block opts into the escape hatch;
    // otherwise it stays stripped on both sides so remote UI groups are left
    // untouched and no false diff is produced.
    const includeGroupUuid = typeof comp.component_group_uuid === 'string';
    const localSerialized = serializeComponent(applyDefaults(comp, COMPONENT_DEFAULTS), { includeGroupUuid });
    const remoteSerialized = remoteComp
      ? serializeComponent(applyDefaults(remoteComp, COMPONENT_DEFAULTS), { includeGroupUuid })
      : null;
    diffs.push(diffEntity('component', comp.name, localSerialized, remoteSerialized));
  }
  for (const [name] of remote.components) {
    if (!processedComponentNames.has(name)) {
      diffs.push(diffEntity('component', name, null, 'stale'));
    }
  }

  // Component groups are normally maintained in code via the directory layout,
  // so a block's group is not diffed by default and existing remote groups are
  // left as-is. A block may opt into the escape hatch by setting
  // `component_group_uuid` explicitly, in which case it is diffed above.

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
