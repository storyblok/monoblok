import chalk from 'chalk';

import type { Component, ComponentFolder, Datasource, DatasourceEntry, Preset } from '../../../types';
import type { FolderNode, ResolvedFolder } from '../folders';
import type { ChangesetEntry, DiffResult, EntityDiff, RemoteSchemaData, SchemaData } from '../types';
import { getMapiClient } from '../../../api';
import { getLogger } from '../../../lib/logger/logger';
import { handleAPIError } from '../../../utils';
import { groupUuidForBlock, pathKey } from '../folders';
import { planEntries, planPresets } from '../reconcile';
import { toComponentCreate, toComponentUpdate, toDatasourceCreate, toDatasourceUpdate } from '../transform';

type MapiClient = ReturnType<typeof getMapiClient>;

/**
 * Reconciles each component's inline `presets` against the remote presets owned
 * by that component (matched by name): creates new, updates changed, deletes
 * orphaned. The inline list is authoritative.
 */
async function reconcilePresets(
  client: MapiClient,
  spaceId: number,
  local: SchemaData,
  remote: RemoteSchemaData,
  componentIdByName: Map<string, number>,
  remotePresets: Preset[],
): Promise<void> {
  const logger = getLogger();

  for (const [componentName, presets] of local.presetsByComponentName) {
    const componentId = componentIdByName.get(componentName) ?? remote.components.get(componentName)?.id;
    if (componentId == null) {
      logger.warn(`Cannot reconcile presets for '${componentName}': component id unknown`);
      continue;
    }

    const ownedRemote = remotePresets.filter(p => p.component_id === componentId);
    const plan = planPresets(presets, ownedRemote);

    await Promise.all([
      ...plan.toCreate.map(p => client.presets.create({
        path: { space_id: spaceId },
        body: { preset: { name: p.name, component_id: componentId, ...(p.preset != null && { preset: p.preset }) } },
        throwOnError: true,
      }).catch(reason => handleAPIError('push_component_preset', reason, `Failed to create preset ${p.name}`))),
      ...plan.toUpdate.map(p => client.presets.update(p.id, {
        path: { space_id: spaceId },
        body: { preset: { name: p.name, component_id: componentId, ...(p.preset != null && { preset: p.preset }) } },
        throwOnError: true,
      }).catch(reason => handleAPIError('update_component_preset', reason, `Failed to update preset ${p.name}`))),
      ...plan.toDelete.map(id => client.presets.delete(id, {
        path: { space_id: spaceId },
        throwOnError: true,
      }).catch(reason => handleAPIError('delete_component_preset', reason, `Failed to delete preset ${id}`))),
    ]);
  }
}

/**
 * Reconciles each datasource's inline `entries` against its remote entries
 * (matched by name + dimension value): creates new, updates changed, deletes
 * orphaned. The inline list is authoritative.
 */
async function reconcileEntries(
  client: MapiClient,
  spaceId: number,
  local: SchemaData,
  datasourceIdByName: Map<string, number>,
  remote: RemoteSchemaData,
  entriesByDatasourceId: Map<number, DatasourceEntry[]>,
): Promise<void> {
  const logger = getLogger();

  for (const [datasourceName, entries] of local.entriesByDatasourceName) {
    const datasourceId = datasourceIdByName.get(datasourceName) ?? remote.datasources.get(datasourceName)?.id;
    if (datasourceId == null) {
      logger.warn(`Cannot reconcile entries for '${datasourceName}': datasource id unknown`);
      continue;
    }

    const plan = planEntries(entries, entriesByDatasourceId.get(datasourceId) ?? []);

    await Promise.all([
      ...plan.toCreate.map(e => client.datasourceEntries.create({
        path: { space_id: spaceId },
        body: { datasource_entry: { name: e.name, value: e.value ?? '', datasource_id: datasourceId, ...(e.dimension_value != null && { dimension_value: e.dimension_value }) } },
        throwOnError: true,
      }).catch(reason => handleAPIError('push_datasource_entry', reason, `Failed to create entry ${e.name}`))),
      ...plan.toUpdate.map(e => client.datasourceEntries.update(e.id, {
        path: { space_id: spaceId },
        body: { datasource_entry: { name: e.name, value: e.value } },
        throwOnError: true,
      }).catch(reason => handleAPIError('update_datasource_entry', reason, `Failed to update entry ${e.name}`))),
      ...plan.toDelete.map(id => client.datasourceEntries.delete(id, {
        path: { space_id: spaceId },
        throwOnError: true,
      }).catch(reason => handleAPIError('delete_datasource_entry', reason, `Failed to delete entry ${id}`))),
    ]);
  }
}

/** Formats diff results for CLI display using chalk colors. */
export function formatDiffOutput(result: DiffResult, options?: { delete?: boolean }): string {
  const lines: string[] = [];

  const byType = {
    component: [] as EntityDiff[],
    componentFolder: [] as EntityDiff[],
    datasource: [] as EntityDiff[],
  };

  for (const diff of result.diffs) {
    byType[diff.type].push(diff);
  }

  const willDelete = options?.delete ?? false;
  const icons: Record<string, string> = {
    create: chalk.green('+'),
    update: chalk.yellow('~'),
    unchanged: chalk.dim('='),
    stale: chalk.red('-'),
  };

  const sections: [string, EntityDiff[]][] = [
    ['Components', byType.component],
    ['Component Folders', byType.componentFolder],
    ['Datasources', byType.datasource],
  ];

  for (const [label, diffs] of sections) {
    if (diffs.length === 0) { continue; }

    lines.push(chalk.bold(label));
    for (const diff of diffs) {
      const icon = icons[diff.action] ?? ' ';
      const name = diff.action === 'stale' ? chalk.red(diff.name) : diff.name;
      const actionLabel = diff.action === 'stale' && willDelete ? 'delete' : diff.action;
      lines.push(`  ${icon} ${name} ${chalk.dim(`(${actionLabel})`)}`);

      if (diff.diff) {
        for (const line of diff.diff.split('\n')) {
          if (line.startsWith('+') && !line.startsWith('+++')) {
            lines.push(`    ${chalk.green(line)}`);
          }
          else if (line.startsWith('-') && !line.startsWith('---')) {
            lines.push(`    ${chalk.red(line)}`);
          }
        }
      }
    }
    lines.push('');
  }

  const summary = [
    result.creates > 0 ? chalk.green(`${result.creates} to create`) : null,
    result.updates > 0 ? chalk.yellow(`${result.updates} to update`) : null,
    result.unchanged > 0 ? chalk.dim(`${result.unchanged} unchanged`) : null,
    result.stale > 0 ? chalk.red(`${result.stale} ${willDelete ? 'to delete' : 'stale'}`) : null,
  ].filter(Boolean).join(', ');

  lines.push(`Summary: ${summary}`);

  return lines.join('\n');
}

/** Pushes local schema changes to the remote space. */
export async function executePush(
  spaceId: string,
  local: SchemaData,
  remote: RemoteSchemaData,
  diffResult: DiffResult,
  options: {
    delete: boolean;
    foldersToCreate?: FolderNode[];
    folderResolution?: Map<string, ResolvedFolder>;
    remotePresets?: Preset[];
    entriesByDatasourceId?: Map<number, DatasourceEntry[]>;
  },
): Promise<{ created: number; updated: number; deleted: number }> {
  const client = getMapiClient();
  const spaceIdNum = Number(spaceId);
  let created = 0;
  let updated = 0;
  let deleted = 0;

  const folderResolution = options.folderResolution ?? new Map<string, ResolvedFolder>();

  // 1. Create missing component groups parent-first (a child needs its parent's id).
  for (const node of options.foldersToCreate ?? []) {
    const parentId = node.parentPath.length > 0
      ? folderResolution.get(pathKey(node.parentPath))?.id
      : undefined;
    // A child whose parent failed to create cannot be placed — skip it.
    if (node.parentPath.length > 0 && parentId == null) { continue; }

    try {
      const response = await client.componentFolders.create({
        path: { space_id: spaceIdNum },
        body: { component_group: { name: node.name, ...(parentId != null && { parent_id: parentId }) } },
        throwOnError: true,
      });
      const group = response.data?.component_group;
      if (group?.id != null && group?.uuid != null) {
        folderResolution.set(pathKey(node.path), { id: group.id, uuid: group.uuid });
      }
      created++;
    }
    catch (reason) {
      handleAPIError('push_component_group', reason, `Failed to create component folder ${node.name}`);
    }
  }

  // 2. Back-fill component_group_uuid for blocks whose group now exists.
  for (const comp of local.components) {
    if (comp.component_group_uuid != null) { continue; }
    const uuid = groupUuidForBlock(local.folderPathByComponentName.get(comp.name), folderResolution);
    if (uuid) { comp.component_group_uuid = uuid; }
  }

  // 3. Upsert components (capturing each component's id for preset reconciliation)
  const componentIdByName = new Map<string, number>();
  const componentDiffs = diffResult.diffs.filter(d => d.type === 'component');
  const componentResults = await Promise.allSettled(
    componentDiffs.map(async (diff) => {
      const localComp = local.components.find(c => c.name === diff.name);
      if (diff.action === 'create' && localComp) {
        const response = await client.components.create({
          path: { space_id: spaceIdNum },
          body: { component: toComponentCreate(localComp) },
          throwOnError: true,
        });
        return { action: 'created' as const, id: response.data?.component?.id };
      }
      if (diff.action === 'update' && localComp) {
        const existing = remote.components.get(diff.name);
        if (existing?.id) {
          await client.components.update(existing.id, {
            path: { space_id: spaceIdNum },
            body: { component: toComponentUpdate(localComp) },
            throwOnError: true,
          });
          return { action: 'updated' as const, id: existing.id };
        }
      }
    }),
  );
  for (let i = 0; i < componentResults.length; i++) {
    const result = componentResults[i];
    const diff = componentDiffs[i];
    if (result.status === 'fulfilled') {
      if (result.value?.action === 'created') { created++; }
      else if (result.value?.action === 'updated') { updated++; }
      if (result.value?.id != null) { componentIdByName.set(diff.name, result.value.id); }
    }
    else {
      const eventId = diff.action === 'create' ? 'push_component' : 'update_component';
      handleAPIError(eventId, result.reason, `Failed to ${diff.action} component ${diff.name}`);
    }
  }

  // 4. Upsert datasources (capturing each datasource's id for entry reconciliation)
  const datasourceIdByName = new Map<string, number>();
  const datasourceDiffs = diffResult.diffs.filter(d => d.type === 'datasource');
  const datasourceResults = await Promise.allSettled(
    datasourceDiffs.map(async (diff) => {
      const localDs = local.datasources.find(d => d.name === diff.name);
      if (diff.action === 'create' && localDs) {
        const response = await client.datasources.create({
          path: { space_id: spaceIdNum },
          body: { datasource: toDatasourceCreate(localDs) },
          throwOnError: true,
        });
        return { action: 'created' as const, id: response.data?.datasource?.id };
      }
      if (diff.action === 'update' && localDs) {
        const existing = remote.datasources.get(diff.name);
        if (existing?.id) {
          await client.datasources.update(existing.id, {
            path: { space_id: spaceIdNum },
            body: { datasource: toDatasourceUpdate(localDs, existing) },
            throwOnError: true,
          });
          return { action: 'updated' as const, id: existing.id };
        }
      }
    }),
  );
  for (let i = 0; i < datasourceResults.length; i++) {
    const result = datasourceResults[i];
    const diff = datasourceDiffs[i];
    if (result.status === 'fulfilled') {
      if (result.value?.action === 'created') { created++; }
      else if (result.value?.action === 'updated') { updated++; }
      if (result.value?.id != null) { datasourceIdByName.set(diff.name, result.value.id); }
    }
    else {
      const eventId = diff.action === 'create' ? 'push_datasource' : 'update_datasource';
      handleAPIError(eventId, result.reason, `Failed to ${diff.action} datasource ${diff.name}`);
    }
  }

  // 4b. Reconcile inline presets (per component) and datasource entries (per datasource).
  await reconcilePresets(client, spaceIdNum, local, remote, componentIdByName, options.remotePresets ?? []);
  await reconcileEntries(client, spaceIdNum, local, datasourceIdByName, remote, options.entriesByDatasourceId ?? new Map());

  // 5. Delete stale entities if --delete flag is set
  if (options.delete) {
    // Delete stale components
    const staleComponents = diffResult.diffs.filter(d => d.type === 'component' && d.action === 'stale');
    const deleteComponentResults = await Promise.allSettled(
      staleComponents.map(async (diff) => {
        const existing = remote.components.get(diff.name);
        if (existing?.id) {
          await client.components.delete(existing.id, {
            path: { space_id: spaceIdNum },
            throwOnError: true,
          });
          return true;
        }
      }),
    );
    for (let i = 0; i < deleteComponentResults.length; i++) {
      const result = deleteComponentResults[i];
      if (result.status === 'fulfilled') {
        if (result.value) { deleted++; }
      }
      else { handleAPIError('push_component', result.reason, `Failed to delete component ${staleComponents[i].name}`); }
    }

    // Delete stale datasources
    const staleDatasources = diffResult.diffs.filter(d => d.type === 'datasource' && d.action === 'stale');
    const deleteDatasourceResults = await Promise.allSettled(
      staleDatasources.map(async (diff) => {
        const existing = remote.datasources.get(diff.name);
        if (existing?.id) {
          await client.datasources.delete(existing.id, {
            path: { space_id: spaceIdNum },
            throwOnError: true,
          });
          return true;
        }
      }),
    );
    for (let i = 0; i < deleteDatasourceResults.length; i++) {
      const result = deleteDatasourceResults[i];
      if (result.status === 'fulfilled') {
        if (result.value) { deleted++; }
      }
      else { handleAPIError('delete_datasource', result.reason, `Failed to delete datasource ${staleDatasources[i].name}`); }
    }

    // Delete stale component folders (last, since components may reference them)
    const staleFolders = diffResult.diffs.filter(d => d.type === 'componentFolder' && d.action === 'stale');
    const deleteFolderResults = await Promise.allSettled(
      staleFolders.map(async (diff) => {
        const existing = remote.componentFolders.get(diff.name);
        if (existing?.id) {
          await client.componentFolders.delete(existing.id, {
            path: { space_id: spaceIdNum },
            throwOnError: true,
          });
          return true;
        }
      }),
    );
    for (let i = 0; i < deleteFolderResults.length; i++) {
      const result = deleteFolderResults[i];
      if (result.status === 'fulfilled') {
        if (result.value) { deleted++; }
      }
      else { handleAPIError('push_component_group', result.reason, `Failed to delete folder ${staleFolders[i].name}`); }
    }
  }

  return { created, updated, deleted };
}

/** Builds changeset entries from diff results for storage. */
export function buildChangesetEntries(
  diffResult: DiffResult,
  local: SchemaData,
  remote: RemoteSchemaData,
  options: { delete: boolean },
): ChangesetEntry[] {
  const changes: ChangesetEntry[] = [];

  for (const diff of diffResult.diffs) {
    if (diff.action === 'unchanged') { continue; }
    if (diff.action === 'stale' && !options.delete) { continue; }

    const action = diff.action === 'stale' ? 'delete' : diff.action;

    let remoteSrc: Component | ComponentFolder | Datasource | undefined;
    let localSrc: Component | ComponentFolder | Datasource | undefined;

    if (diff.type === 'component') {
      remoteSrc = remote.components.get(diff.name);
      localSrc = local.components.find(c => c.name === diff.name);
    }
    else if (diff.type === 'componentFolder') {
      remoteSrc = remote.componentFolders.get(diff.name);
      localSrc = local.componentFolders.find(f => f.name === diff.name);
    }
    else if (diff.type === 'datasource') {
      remoteSrc = remote.datasources.get(diff.name);
      localSrc = local.datasources.find(d => d.name === diff.name);
    }

    changes.push({
      type: diff.type,
      name: diff.name,
      action,
      ...(remoteSrc && { before: { ...remoteSrc } }),
      ...(localSrc && { after: { ...localSrc } }),
    });
  }

  return changes;
}
