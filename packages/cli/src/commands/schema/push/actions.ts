import chalk from 'chalk';

import type { Component } from '../../../types';
import type { ChangesetEntry, DiffResult, EntityDiff, LocalFolder, RemoteSchemaData, SchemaData } from '../types';
import { getMapiClient } from '../../../api';
import { CommandError, handleAPIError } from '../../../utils';
import { toComponentCreate, toComponentUpdate, toDatasourceCreate, toDatasourceUpdate } from '../transform';
import { buildGroupPathByUuid } from '../folders';
import { isRecord } from '../utils';

/** A resolved component group reference: its numeric id and server uuid. */
interface GroupRef { id: number; uuid: string }

/**
 * Resolves a local block's transient path-space group keys to server uuids and
 * strips the `folder` key. A `folder` string path becomes `component_group_uuid`
 * (the resolved group's uuid); `folder: null` clears it. Each field's
 * `component_group_whitelist` slug paths are mapped to uuids (unknown paths —
 * e.g. already-uuid entries — are left as-is). Blocks without a `folder` key are
 * untouched. An unresolvable `folder` path throws a {@link CommandError}: this
 * is a defensive invariant, since folder creation precedes this step and aborts
 * the push on failure.
 */
function resolveGroupRefs(comp: Component, groupByPath: Map<string, GroupRef>): Component {
  const { folder, ...rest } = comp as Record<string, unknown>;
  const resolved: Record<string, unknown> = { ...rest };

  if (typeof folder === 'string') {
    const group = groupByPath.get(folder);
    if (!group) {
      throw new CommandError(
        `Unknown folder path "${folder}" for component "${comp.name}": no matching component group exists. `
        + `Folder creation runs before component push, so this indicates an internal inconsistency.`,
      );
    }
    resolved.component_group_uuid = group.uuid;
  }
  else if (folder === null) {
    resolved.component_group_uuid = null;
  }

  if (isRecord(resolved.schema)) {
    const schema: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(resolved.schema)) {
      if (isRecord(field) && Array.isArray(field.component_group_whitelist)) {
        schema[key] = {
          ...field,
          component_group_whitelist: field.component_group_whitelist.map(path =>
            (typeof path === 'string' ? groupByPath.get(path)?.uuid ?? path : path)),
        };
      }
      else {
        schema[key] = field;
      }
    }
    resolved.schema = schema;
  }

  return resolved as unknown as Component;
}

/** Builds a `slug path → { id, uuid }` map from the remote component groups. */
function buildGroupByPath(remote: RemoteSchemaData): Map<string, GroupRef> {
  const remoteFolders = [...remote.componentFolders.values()];
  const groupPathByUuid = buildGroupPathByUuid(remoteFolders);
  const groupByPath = new Map<string, GroupRef>();
  for (const folder of remoteFolders) {
    const segments = groupPathByUuid.get(folder.uuid);
    if (segments?.length) {
      groupByPath.set(segments.join('/'), { id: folder.id, uuid: folder.uuid });
    }
  }
  return groupByPath;
}

/** Formats diff results for CLI display using chalk colors. */
export function formatDiffOutput(result: DiffResult, options?: { delete?: boolean }): string {
  const lines: string[] = [];

  const byType = {
    component: [] as EntityDiff[],
    datasource: [] as EntityDiff[],
    folder: [] as EntityDiff[],
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
    ['Folders', byType.folder],
    ['Components', byType.component],
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
  options: { delete: boolean },
): Promise<{ created: number; updated: number; deleted: number }> {
  const client = getMapiClient();
  const spaceIdNum = Number(spaceId);
  let created = 0;
  let updated = 0;
  let deleted = 0;

  // 1. Create missing folders (component groups) parent-first, building a
  //    `slug path → { id, uuid }` map from the remote groups plus the ones we
  //    create. Creation is sequential on purpose: a child needs its parent's id.
  const groupByPath = buildGroupByPath(remote);
  const foldersByPath = new Map<string, LocalFolder>(local.folders.map(f => [f.path, f]));
  const folderCreates = diffResult.diffs
    .filter(d => d.type === 'folder' && d.action === 'create')
    // Parent-first: shallower paths (fewer segments) are created before deeper ones.
    .sort((a, b) => a.name.split('/').length - b.name.split('/').length);
  for (const diff of folderCreates) {
    const localFolder = foldersByPath.get(diff.name);
    if (!localFolder) { continue; }
    const parent = localFolder.parentPath ? groupByPath.get(localFolder.parentPath) : undefined;
    try {
      const res = await client.componentFolders.create({
        path: { space_id: spaceIdNum },
        body: { component_group: { name: localFolder.name, parent_id: parent?.id ?? null } },
        throwOnError: true,
      });
      const createdGroup = res.data?.component_group;
      if (createdGroup?.id != null && createdGroup.uuid) {
        groupByPath.set(localFolder.path, { id: createdGroup.id, uuid: createdGroup.uuid });
        created++;
      }
    }
    catch (error) {
      handleAPIError('push_component_folder', error, `Failed to create folder ${localFolder.name}`);
    }
  }

  // 2. Upsert components. Each block's group membership is resolved from its
  //    transient `folder`/whitelist slug paths to server uuids just before the
  //    payload is built (`resolveGroupRefs`); the `folder` key never reaches the
  //    Management API. Blocks without a `folder` key stay unmanaged.
  const componentDiffs = diffResult.diffs.filter(d => d.type === 'component');
  // Resolve group refs synchronously up front so an unknown folder path surfaces
  // as a clear `CommandError` here, rather than being wrapped as a per-component
  // API error inside the settled-results loop below.
  const resolvedComponents = new Map<string, Component>();
  for (const diff of componentDiffs) {
    if (diff.action !== 'create' && diff.action !== 'update') { continue; }
    const localComp = local.components.find(c => c.name === diff.name);
    if (localComp) { resolvedComponents.set(diff.name, resolveGroupRefs(localComp, groupByPath)); }
  }
  const componentResults = await Promise.allSettled(
    componentDiffs.map(async (diff) => {
      const resolvedComp = resolvedComponents.get(diff.name);
      if (diff.action === 'create' && resolvedComp) {
        await client.components.create({
          path: { space_id: spaceIdNum },
          body: { component: toComponentCreate(resolvedComp) },
          throwOnError: true,
        });
        return 'created' as const;
      }
      if (diff.action === 'update' && resolvedComp) {
        const existing = remote.components.get(diff.name);
        if (existing?.id) {
          await client.components.update(existing.id, {
            path: { space_id: spaceIdNum },
            body: { component: toComponentUpdate(resolvedComp) },
            throwOnError: true,
          });
          return 'updated' as const;
        }
      }
    }),
  );
  for (let i = 0; i < componentResults.length; i++) {
    const result = componentResults[i];
    const diff = componentDiffs[i];
    if (result.status === 'fulfilled') {
      if (result.value === 'created') { created++; }
      else if (result.value === 'updated') { updated++; }
    }
    else {
      const eventId = diff.action === 'create' ? 'push_component' : 'update_component';
      handleAPIError(eventId, result.reason, `Failed to ${diff.action} component ${diff.name}`);
    }
  }

  // 3. Upsert datasources
  const datasourceDiffs = diffResult.diffs.filter(d => d.type === 'datasource');
  const datasourceResults = await Promise.allSettled(
    datasourceDiffs.map(async (diff) => {
      const localDs = local.datasources.find(d => d.name === diff.name);
      if (diff.action === 'create' && localDs) {
        await client.datasources.create({
          path: { space_id: spaceIdNum },
          body: { datasource: toDatasourceCreate(localDs) },
          throwOnError: true,
        });
        return 'created' as const;
      }
      if (diff.action === 'update' && localDs) {
        const existing = remote.datasources.get(diff.name);
        if (existing?.id) {
          await client.datasources.update(existing.id, {
            path: { space_id: spaceIdNum },
            body: { datasource: toDatasourceUpdate(localDs, existing) },
            throwOnError: true,
          });
          return 'updated' as const;
        }
      }
    }),
  );
  for (let i = 0; i < datasourceResults.length; i++) {
    const result = datasourceResults[i];
    const diff = datasourceDiffs[i];
    if (result.status === 'fulfilled') {
      if (result.value === 'created') { created++; }
      else if (result.value === 'updated') { updated++; }
    }
    else {
      const eventId = diff.action === 'create' ? 'push_datasource' : 'update_datasource';
      handleAPIError(eventId, result.reason, `Failed to ${diff.action} datasource ${diff.name}`);
    }
  }

  // 4. Delete stale entities if --delete flag is set.
  //
  // Deletes are attempted across all three entity types even if some fail; the
  // first failure is surfaced only after folders have been processed. This
  // matters because an undeletable stale component (e.g. the space's default
  // content type, which the API rejects with a 422) must not abort the push
  // before stale folders are cleaned up, or those groups are left orphaned.
  if (options.delete) {
    const deleteErrors: { action: 'delete_component' | 'delete_datasource' | 'delete_component_folder'; reason: unknown; message: string }[] = [];

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
      else { deleteErrors.push({ action: 'delete_component', reason: result.reason, message: `Failed to delete component ${staleComponents[i].name}` }); }
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
      else { deleteErrors.push({ action: 'delete_datasource', reason: result.reason, message: `Failed to delete datasource ${staleDatasources[i].name}` }); }
    }

    // Delete stale folders children-first (deeper slug paths before their
    // parents), after stale components so no block references a removed group.
    const staleFolders = diffResult.diffs
      .filter(d => d.type === 'folder' && d.action === 'stale')
      .sort((a, b) => b.name.split('/').length - a.name.split('/').length);
    for (const diff of staleFolders) {
      const group = groupByPath.get(diff.name);
      if (!group) { continue; }
      try {
        await client.componentFolders.delete(group.id, {
          path: { space_id: spaceIdNum },
          throwOnError: true,
        });
        deleted++;
      }
      catch (error) {
        deleteErrors.push({ action: 'delete_component_folder', reason: error, message: `Failed to delete folder ${diff.name}` });
      }
    }

    // Surface the first delete failure now that every stale entity has been
    // attempted. Additional failures are appended to the message so none are
    // silently swallowed.
    if (deleteErrors.length > 0) {
      const first = deleteErrors[0];
      const suffix = deleteErrors.length > 1 ? ` (and ${deleteErrors.length - 1} more delete error(s))` : '';
      handleAPIError(first.action, first.reason, `${first.message}${suffix}`);
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

  // Map remote folders by slug path so folder diffs (whose `name` is the slug
  // path) can recover the pre-push remote group as their `before` snapshot.
  const remoteFolders = [...remote.componentFolders.values()];
  const folderPathByUuid = buildGroupPathByUuid(remoteFolders);
  const remoteFolderByPath = new Map<string, Record<string, unknown>>();
  for (const folder of remoteFolders) {
    const segments = folderPathByUuid.get(folder.uuid);
    if (segments?.length) { remoteFolderByPath.set(segments.join('/'), folder as unknown as Record<string, unknown>); }
  }

  for (const diff of diffResult.diffs) {
    if (diff.action === 'unchanged') { continue; }
    if (diff.action === 'stale' && !options.delete) { continue; }

    const action = diff.action === 'stale' ? 'delete' : diff.action;

    let remoteSrc: Record<string, unknown> | undefined;
    let localSrc: Record<string, unknown> | undefined;

    if (diff.type === 'component') {
      remoteSrc = remote.components.get(diff.name);
      localSrc = local.components.find(c => c.name === diff.name);
    }
    else if (diff.type === 'datasource') {
      remoteSrc = remote.datasources.get(diff.name);
      localSrc = local.datasources.find(d => d.name === diff.name);
    }
    else if (diff.type === 'folder') {
      remoteSrc = remoteFolderByPath.get(diff.name);
      localSrc = local.folders.find(f => f.path === diff.name) as unknown as Record<string, unknown> | undefined;
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
