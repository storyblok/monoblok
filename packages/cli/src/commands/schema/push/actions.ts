import chalk from 'chalk';

import type { ChangesetEntry, DiffResult, EntityDiff, RemoteSchemaData, SchemaData } from '../types';
import { getMapiClient } from '../../../api';
import { getLogger } from '../../../lib/logger/logger';
import { handleAPIError } from '../../../utils';
import { toComponentCreate, toComponentFolderCreate, toComponentUpdate, toDatasourceCreate, toDatasourceUpdate } from '../transform';

export { toComponentCreate, toComponentFolderCreate, toComponentUpdate, toDatasourceCreate, toDatasourceUpdate } from '../transform';

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
  options: { delete: boolean; pendingFolderAssignments?: Map<string, string[]> },
): Promise<{ created: number; updated: number; deleted: number }> {
  const client = getMapiClient();
  const spaceIdNum = Number(spaceId);
  let created = 0;
  let updated = 0;
  let deleted = 0;

  // Map of folder name → remote UUID, populated as folders are created
  const createdFolderUuids = new Map<string, string>();

  // 1. Upsert component folders first (components may reference them)
  for (const diff of diffResult.diffs.filter(d => d.type === 'componentFolder')) {
    const localFolder = local.componentFolders.find(f => f.name === diff.name);
    if (diff.action === 'create' && localFolder) {
      const payload = toComponentFolderCreate(localFolder);
      try {
        const response = await client.componentFolders.create({
          path: { space_id: spaceIdNum },
          body: { component_group: payload },
          throwOnError: true,
        });
        const remoteUuid = response.data?.component_group?.uuid;
        if (remoteUuid) {
          createdFolderUuids.set(diff.name, remoteUuid);
        }
        created++;
      }
      catch (error) {
        handleAPIError('push_component_group', error as Error, `Failed to create component folder ${diff.name}`);
      }
    }
    else if (diff.action === 'update' && localFolder) {
      const existing = remote.componentFolders.get(diff.name);
      if (existing?.id) {
        const payload = toComponentFolderCreate(localFolder);
        try {
          await client.componentFolders.update(existing.id, {
            path: { space_id: spaceIdNum },
            body: { component_group: payload },
            throwOnError: true,
          });
          updated++;
        }
        catch (error) {
          handleAPIError('update_component_group', error as Error, `Failed to update component folder ${diff.name}`);
        }
      }
    }
  }

  // 2. Resolve pending folder assignments (folders that were just created)
  const skippedComponents = new Set<string>();
  if (options.pendingFolderAssignments) {
    const logger = getLogger();
    for (const [folderName, componentNames] of options.pendingFolderAssignments) {
      const remoteUuid = createdFolderUuids.get(folderName);
      if (!remoteUuid) {
        logger.warn(`Could not resolve folder '${folderName}' — skipping components: ${componentNames.join(', ')}`);
        for (const name of componentNames) { skippedComponents.add(name); }
        continue;
      }
      for (const compName of componentNames) {
        const comp = local.components.find(c => c.name === compName);
        if (comp) {
          comp.component_group_uuid = remoteUuid;
        }
      }
    }
  }

  // 3. Upsert components
  for (const diff of diffResult.diffs.filter(d => d.type === 'component')) {
    if (skippedComponents.has(diff.name)) { continue; }
    const localComp = local.components.find(c => c.name === diff.name);
    if (diff.action === 'create' && localComp) {
      const payload = toComponentCreate(localComp);
      try {
        await client.components.create({
          path: { space_id: spaceIdNum },
          body: { component: payload },
          throwOnError: true,
        });
        created++;
      }
      catch (error) {
        handleAPIError('push_component', error as Error, `Failed to create component ${diff.name}`);
      }
    }
    else if (diff.action === 'update' && localComp) {
      const existing = remote.components.get(diff.name);
      if (existing?.id) {
        const payload = toComponentUpdate(localComp);
        try {
          await client.components.update(existing.id, {
            path: { space_id: spaceIdNum },
            body: { component: payload },
            throwOnError: true,
          });
          updated++;
        }
        catch (error) {
          handleAPIError('update_component', error as Error, `Failed to update component ${diff.name}`);
        }
      }
    }
  }

  // 4. Upsert datasources
  for (const diff of diffResult.diffs.filter(d => d.type === 'datasource')) {
    const localDs = local.datasources.find(d => d.name === diff.name);
    if (diff.action === 'create' && localDs) {
      const payload = toDatasourceCreate(localDs);
      try {
        await client.datasources.create({
          path: { space_id: spaceIdNum },
          body: { datasource: payload },
          throwOnError: true,
        });
        created++;
      }
      catch (error) {
        handleAPIError('push_datasource', error as Error, `Failed to create datasource ${diff.name}`);
      }
    }
    else if (diff.action === 'update' && localDs) {
      const existing = remote.datasources.get(diff.name);
      if (existing?.id) {
        const payload = toDatasourceUpdate(localDs, existing);
        try {
          await client.datasources.update(existing.id, {
            path: { space_id: spaceIdNum },
            body: { datasource: payload },
            throwOnError: true,
          });
          updated++;
        }
        catch (error) {
          handleAPIError('update_datasource', error as Error, `Failed to update datasource ${diff.name}`);
        }
      }
    }
  }

  // 5. Delete stale entities if --delete flag is set
  if (options.delete) {
    // Delete stale components
    for (const diff of diffResult.diffs.filter(d => d.type === 'component' && d.action === 'stale')) {
      const existing = remote.components.get(diff.name);
      if (existing?.id) {
        try {
          await client.components.delete(existing.id, {
            path: { space_id: spaceIdNum },
            throwOnError: true,
          });
          deleted++;
        }
        catch (error) {
          handleAPIError('push_component', error as Error, `Failed to delete component ${diff.name}`);
        }
      }
    }

    // Delete stale datasources
    for (const diff of diffResult.diffs.filter(d => d.type === 'datasource' && d.action === 'stale')) {
      const existing = remote.datasources.get(diff.name);
      if (existing?.id) {
        try {
          await client.datasources.delete(existing.id, {
            path: { space_id: spaceIdNum },
            throwOnError: true,
          });
          deleted++;
        }
        catch (error) {
          handleAPIError('delete_datasource', error as Error, `Failed to delete datasource ${diff.name}`);
        }
      }
    }

    // Delete stale component folders (last, since components may reference them)
    for (const diff of diffResult.diffs.filter(d => d.type === 'componentFolder' && d.action === 'stale')) {
      const existing = remote.componentFolders.get(diff.name);
      if (existing?.id) {
        try {
          await client.componentFolders.delete(existing.id, {
            path: { space_id: spaceIdNum },
            throwOnError: true,
          });
          deleted++;
        }
        catch (error) {
          handleAPIError('push_component_group', error as Error, `Failed to delete folder ${diff.name}`);
        }
      }
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
