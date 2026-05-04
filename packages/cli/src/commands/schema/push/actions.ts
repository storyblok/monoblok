import chalk from 'chalk';

import type { Component, ComponentCreate, ComponentFolder, ComponentFolderCreate, ComponentSchemaField, ComponentUpdate, Datasource, DatasourceCreate } from '../../../types';
import type { ChangesetEntry, DiffResult, EntityDiff, RemoteSchemaData, SchemaData } from '../types';
import { getMapiClient } from '../../../api';
import { getLogger } from '../../../lib/logger/logger';
import { fetchAllPages, handleAPIError } from '../../../utils';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSchemaField(value: unknown): value is ComponentSchemaField {
  return isRecord(value) && 'type' in value;
}

/** Converts a Component's schema (which includes _uid/component sentinels) to a clean record. */
function toSchemaRecord(schema: Record<string, unknown>): Record<string, ComponentSchemaField> {
  const result: Record<string, ComponentSchemaField> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === '_uid' || key === 'component' || !isSchemaField(value)) { continue; }
    result[key] = value;
  }
  return result;
}

/** Builds the shared component payload fields used for both create and update. */
function buildComponentPayload(input: unknown) {
  if (!isRecord(input)) { return { name: '' }; }

  return {
    name: typeof input.name === 'string' ? input.name : '',
    // Fields in COMPONENT_DEFAULTS are always sent with their reset value so that
    // removing a field from the local schema actually clears it on the API.
    // (Root-level fields are additive on MAPI update — omitting preserves the old value.)
    display_name: typeof input.display_name === 'string' ? input.display_name : '',
    color: typeof input.color === 'string' ? input.color : '',
    icon: typeof input.icon === 'string' ? input.icon : '',
    preview_field: typeof input.preview_field === 'string' ? input.preview_field : '',
    internal_tag_ids: Array.isArray(input.internal_tag_ids) ? input.internal_tag_ids : [],
    // Conditionally sent: only included when explicitly set in local schema
    ...(isRecord(input.schema) && { schema: toSchemaRecord(input.schema) }),
    ...(typeof input.is_root === 'boolean' && { is_root: input.is_root }),
    ...(typeof input.is_nestable === 'boolean' && { is_nestable: input.is_nestable }),
    ...(typeof input.component_group_uuid === 'string' && { component_group_uuid: input.component_group_uuid }),
  };
}

/** Converts an unknown input to a ComponentCreate-compatible payload. */
export function toComponentCreate(input: unknown): ComponentCreate {
  return buildComponentPayload(input) satisfies ComponentCreate;
}

/** Converts an unknown input to a DatasourceCreate-compatible payload. */
export function toDatasourceCreate(input: unknown): DatasourceCreate {
  if (!isRecord(input)) { return { name: '', slug: '' }; }

  const result: DatasourceCreate = {
    name: typeof input.name === 'string' ? input.name : '',
    slug: typeof input.slug === 'string' ? input.slug : '',
  };

  if (Array.isArray(input.dimensions)) {
    result.dimensions_attributes = input.dimensions
      .filter((d: unknown) => isRecord(d) && typeof d.name === 'string' && typeof d.entry_value === 'string')
      .map((d: Record<string, unknown>) => ({
        name: d.name as string,
        entry_value: d.entry_value as string,
      }));
  }

  return result;
}

/**
 * Builds a datasource update payload that handles dimension deletions.
 * The Storyblok API requires `{ id, _destroy: true }` to remove dimensions;
 * an empty `dimensions_attributes` array is a no-op.
 */
export function toDatasourceUpdate(input: unknown, remote: Datasource): Record<string, unknown> {
  const base = toDatasourceCreate(input);
  const localDims = base.dimensions_attributes ?? [];
  const remoteDims = remote.dimensions ?? [];

  if (remoteDims.length === 0) { return base; }

  const localKeys = new Set(localDims.map(d => `${d.name}::${d.entry_value}`));
  const destroyEntries = remoteDims
    .filter(rd => rd.id != null && !localKeys.has(`${rd.name}::${rd.entry_value}`))
    .map(rd => ({ id: rd.id, _destroy: true }));

  if (destroyEntries.length > 0) {
    return {
      ...base,
      dimensions_attributes: [...localDims, ...destroyEntries],
    };
  }

  return base;
}

/** Converts an unknown input to a ComponentUpdate-compatible payload. */
export function toComponentUpdate(input: unknown): ComponentUpdate {
  return buildComponentPayload(input) satisfies ComponentUpdate;
}

/** Converts an unknown input to a ComponentFolderCreate-compatible payload. */
export function toComponentFolderCreate(input: unknown): ComponentFolderCreate {
  if (!isRecord(input)) { return { name: '' }; }

  return {
    name: typeof input.name === 'string' ? input.name : '',
    ...(typeof input.parent_id === 'number' && { parent_id: input.parent_id }),
  } satisfies ComponentFolderCreate;
}

/** Fetches remote components, component folders, and datasources from the MAPI. */
export async function fetchRemoteSchema(spaceId: string) {
  const client = getMapiClient();
  const spaceIdNum = Number(spaceId);

  const [componentsRes, foldersRes, rawDatasources] = await Promise.all([
    client.components.list({ path: { space_id: spaceIdNum }, throwOnError: true }),
    client.componentFolders.list({ path: { space_id: spaceIdNum }, throwOnError: true }),
    fetchAllPages(
      (page: number) => client.datasources.list({ path: { space_id: spaceIdNum }, query: { page }, throwOnError: true }),
      data => data?.datasources ?? [],
    ),
  ]);

  const rawComponents = componentsRes.data?.components ?? [];
  const rawComponentFolders = foldersRes.data?.component_groups ?? [];

  const remote: RemoteSchemaData = {
    components: new Map(rawComponents.map(c => [c.name, c])),
    componentFolders: new Map(rawComponentFolders.map(f => [f.name, f])),
    datasources: new Map(rawDatasources.map(d => [d.name, d])),
  };

  return { remote, rawComponents, rawComponentFolders, rawDatasources };
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
