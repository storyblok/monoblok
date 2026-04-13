import { readFile } from 'node:fs/promises';
import { join } from 'pathe';
import chalk from 'chalk';
import { createTwoFilesPatch } from 'diff';

import type { ChangesetData, ChangesetEntry, RemoteSchemaData } from '../types';
import { applyDefaults, COMPONENT_DEFAULTS } from '../utils';
import { serializeComponent, serializeComponentFolder, serializeDatasource } from '../push/serialize';
import { getMapiClient } from '../../../api';
import { handleAPIError } from '../../../utils';
import { fileExists, readDirectory } from '../../../utils/filesystem';
import {
  toComponentCreate,
  toComponentFolderCreate,
  toComponentUpdate,
  toDatasourceCreate,
  toDatasourceUpdate,
} from '../push/actions';

/** API-assigned fields stripped before sending a rollback create payload to MAPI. */
const API_ASSIGNED_FIELDS = [
  'id',
  'created_at',
  'updated_at',
  'real_name',
  'all_presets',
  'image',
  'uuid',
] as const;

/** Removes API-assigned fields from a raw changeset snapshot before sending as a create payload. */
function stripApiFields(payload: Record<string, unknown>): Record<string, unknown> {
  const result = { ...payload };
  for (const field of API_ASSIGNED_FIELDS) {
    delete result[field];
  }
  return result;
}

/** A single rollback operation derived by inverting a `ChangesetEntry`. */
export interface RollbackOp {
  type: 'component' | 'componentFolder' | 'datasource';
  name: string;
  action: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
}

/**
 * Lists changeset JSON files sorted newest-first.
 *
 * @param basePath - Base storage directory (e.g. `.storyblok`).
 * @returns Full file paths sorted newest-first. Empty array if the directory does not exist or has no `.json` files.
 */
export async function listChangesets(basePath: string): Promise<string[]> {
  const dir = join(basePath, 'schema', 'changesets');

  if (!(await fileExists(dir))) {
    return [];
  }

  const files = await readDirectory(dir);
  return files
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .map(f => join(dir, f));
}

/**
 * Reads and JSON-parses a changeset file.
 *
 * @param filePath - Absolute path to the changeset `.json` file.
 * @returns Parsed `ChangesetData`.
 * @throws If the file does not exist or cannot be parsed as JSON.
 */
export async function loadChangeset(filePath: string): Promise<ChangesetData> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as ChangesetData;
}

/**
 * Inverts each entry in a changeset into a `RollbackOp`:
 * - `create` → `delete` (ID resolved from live remote at execution time)
 * - `update` → `update` with `entry.before` as the restore payload
 * - `delete` → `create` with `entry.before` as the restore payload
 *
 * @param changeset - The changeset to invert.
 * @returns Array of rollback ops, or empty array if the changeset has no changes.
 */
export function buildRollbackOps(changeset: ChangesetData): RollbackOp[] {
  if (changeset.changes.length === 0) {
    return [];
  }

  return changeset.changes.map((entry): RollbackOp => {
    switch (entry.action) {
      case 'create':
        return { type: entry.type, name: entry.name, action: 'delete', payload: {} };
      case 'update':
        return { type: entry.type, name: entry.name, action: 'update', payload: entry.before ?? {} };
      case 'delete':
        return { type: entry.type, name: entry.name, action: 'create', payload: entry.before ?? {} };
      default:
        return { type: entry.type, name: entry.name, action: entry.action, payload: {} };
    }
  });
}

/** Maps a changeset action to the rollback action that inverts it. */
function rollbackAction(original: ChangesetEntry['action']): 'create' | 'update' | 'delete' {
  switch (original) {
    case 'create': return 'delete';
    case 'update': return 'update';
    case 'delete': return 'create';
  }
}

/**
 * Formats changeset entries as a rollback diff for CLI display.
 * Shows field-level unified diffs for updates, using chalk colors.
 */
export function formatRollbackOutput(changes: ChangesetEntry[]): string {
  const byType: Record<string, ChangesetEntry[]> = {
    component: [],
    componentFolder: [],
    datasource: [],
  };
  for (const entry of changes) {
    byType[entry.type]?.push(entry);
  }

  const icons: Record<string, string> = {
    create: chalk.green('+'),
    update: chalk.yellow('~'),
    delete: chalk.red('-'),
  };

  const lines: string[] = [];
  const sections: [string, ChangesetEntry[]][] = [
    ['Components', byType.component],
    ['Component Folders', byType.componentFolder],
    ['Datasources', byType.datasource],
  ];

  for (const [label, entries] of sections) {
    if (entries.length === 0) { continue; }
    lines.push(chalk.bold(label));

    for (const entry of entries) {
      const action = rollbackAction(entry.action);
      const icon = icons[action] ?? ' ';
      const name = action === 'delete' ? chalk.red(entry.name) : entry.name;
      lines.push(`  ${icon} ${name} ${chalk.dim(`(${action})`)}`);

      // For updates, diff current state (after) → restored state (before)
      if (entry.action === 'update' && entry.before && entry.after) {
        let fromStr: string;
        let toStr: string;

        if (entry.type === 'component') {
          fromStr = serializeComponent(applyDefaults(entry.after, COMPONENT_DEFAULTS));
          toStr = serializeComponent(applyDefaults(entry.before, COMPONENT_DEFAULTS));
        }
        else if (entry.type === 'componentFolder') {
          fromStr = serializeComponentFolder(entry.after);
          toStr = serializeComponentFolder(entry.before);
        }
        else {
          fromStr = serializeDatasource(entry.after);
          toStr = serializeDatasource(entry.before);
        }

        if (fromStr !== toStr) {
          const patch = createTwoFilesPatch(
            `current/${entry.name}`,
            `restore/${entry.name}`,
            fromStr,
            toStr,
            'current',
            'restore',
          );
          for (const line of patch.split('\n')) {
            if (line.startsWith('+') && !line.startsWith('+++')) {
              lines.push(`    ${chalk.green(line)}`);
            }
            else if (line.startsWith('-') && !line.startsWith('---')) {
              lines.push(`    ${chalk.red(line)}`);
            }
          }
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

/**
 * Applies rollback ops to the MAPI in dependency-safe order:
 * 1. Folder creates/updates (maps old folder UUID → new remote UUID)
 * 2. Remap component_group_uuid refs to newly created folder UUIDs
 * 3. Component creates/updates
 * 4. Datasource creates/updates
 * 5. Datasource deletes
 * 6. Component deletes
 * 7. Folder deletes (last — components may still reference them during deletion)
 *
 * @param spaceId - The Storyblok space ID.
 * @param ops - Rollback ops to apply.
 * @param remote - Current live remote state used for entity ID lookups.
 * @returns Counts of created, updated, and deleted entities.
 */
export async function executeRollback(
  spaceId: string,
  ops: RollbackOp[],
  remote: RemoteSchemaData,
): Promise<{ created: number; updated: number; deleted: number }> {
  const client = getMapiClient();
  const spaceIdNum = Number(spaceId);
  let created = 0;
  let updated = 0;
  let deleted = 0;

  const folderOps = ops.filter(op => op.type === 'componentFolder');
  const componentOps = ops.filter(op => op.type === 'component');
  const datasourceOps = ops.filter(op => op.type === 'datasource');

  // Maps old folder UUID → new remote UUID (populated during folder creation)
  const folderUuidRemap = new Map<string, string>();

  // 1. Folder creates/updates first (components may reference them)
  for (const op of folderOps.filter(o => o.action !== 'delete')) {
    if (op.action === 'create') {
      const oldUuid = op.payload.uuid;
      const payload = toComponentFolderCreate(stripApiFields(op.payload));
      try {
        const response = await client.componentFolders.create({
          path: { space_id: spaceIdNum },
          body: { component_group: payload },
          throwOnError: true,
        });
        const remoteUuid = response.data?.component_group?.uuid;
        if (remoteUuid && typeof oldUuid === 'string') {
          folderUuidRemap.set(oldUuid, remoteUuid);
        }
        created++;
      }
      catch (error) {
        handleAPIError('push_component_group', error as Error, `Failed to create folder ${op.name}`);
      }
    }
    else if (op.action === 'update') {
      const existing = remote.componentFolders.get(op.name);
      if (existing?.id) {
        const payload = toComponentFolderCreate(stripApiFields(op.payload));
        try {
          await client.componentFolders.update(existing.id, {
            path: { space_id: spaceIdNum },
            body: { component_group: payload },
            throwOnError: true,
          });
          updated++;
        }
        catch (error) {
          handleAPIError('update_component_group', error as Error, `Failed to update folder ${op.name}`);
        }
      }
    }
  }

  // 2. Remap component_group_uuid for components referencing newly created folders
  for (const op of componentOps) {
    const oldUuid = op.payload.component_group_uuid;
    if (typeof oldUuid !== 'string') { continue; }
    const newUuid = folderUuidRemap.get(oldUuid);
    if (newUuid) {
      op.payload.component_group_uuid = newUuid;
    }
  }

  // 3. Component creates/updates
  for (const op of componentOps.filter(o => o.action !== 'delete')) {
    if (op.action === 'create') {
      const payload = toComponentCreate(stripApiFields(op.payload));
      try {
        await client.components.create({
          path: { space_id: spaceIdNum },
          body: { component: payload },
          throwOnError: true,
        });
        created++;
      }
      catch (error) {
        handleAPIError('push_component', error as Error, `Failed to create component ${op.name}`);
      }
    }
    else if (op.action === 'update') {
      const existing = remote.components.get(op.name);
      if (existing?.id) {
        const payload = toComponentUpdate(stripApiFields(op.payload));
        try {
          await client.components.update(existing.id, {
            path: { space_id: spaceIdNum },
            body: { component: payload },
            throwOnError: true,
          });
          updated++;
        }
        catch (error) {
          handleAPIError('update_component', error as Error, `Failed to update component ${op.name}`);
        }
      }
    }
  }

  // 4. Datasource creates/updates
  for (const op of datasourceOps.filter(o => o.action !== 'delete')) {
    if (op.action === 'create') {
      const payload = toDatasourceCreate(stripApiFields(op.payload));
      try {
        await client.datasources.create({
          path: { space_id: spaceIdNum },
          body: { datasource: payload },
          throwOnError: true,
        });
        created++;
      }
      catch (error) {
        handleAPIError('push_datasource', error as Error, `Failed to create datasource ${op.name}`);
      }
    }
    else if (op.action === 'update') {
      const existing = remote.datasources.get(op.name);
      if (existing?.id) {
        const payload = toDatasourceUpdate(stripApiFields(op.payload), existing);
        try {
          await client.datasources.update(existing.id, {
            path: { space_id: spaceIdNum },
            body: { datasource: payload },
            throwOnError: true,
          });
          updated++;
        }
        catch (error) {
          handleAPIError('update_datasource', error as Error, `Failed to update datasource ${op.name}`);
        }
      }
    }
  }

  // 5. Datasource deletes
  for (const op of datasourceOps.filter(o => o.action === 'delete')) {
    const existing = remote.datasources.get(op.name);
    if (existing?.id) {
      try {
        await client.datasources.delete(existing.id, {
          path: { space_id: spaceIdNum },
          throwOnError: true,
        });
        deleted++;
      }
      catch (error) {
        handleAPIError('delete_datasource', error as Error, `Failed to delete datasource ${op.name}`);
      }
    }
  }

  // 6. Component deletes
  for (const op of componentOps.filter(o => o.action === 'delete')) {
    const existing = remote.components.get(op.name);
    if (existing?.id) {
      try {
        await client.components.delete(existing.id, {
          path: { space_id: spaceIdNum },
          throwOnError: true,
        });
        deleted++;
      }
      catch (error) {
        handleAPIError('push_component', error as Error, `Failed to delete component ${op.name}`);
      }
    }
  }

  // 7. Folder deletes last (components may reference them)
  for (const op of folderOps.filter(o => o.action === 'delete')) {
    const existing = remote.componentFolders.get(op.name);
    if (existing?.id) {
      try {
        await client.componentFolders.delete(existing.id, {
          path: { space_id: spaceIdNum },
          throwOnError: true,
        });
        deleted++;
      }
      catch (error) {
        handleAPIError('push_component_group', error as Error, `Failed to delete folder ${op.name}`);
      }
    }
  }

  return { created, updated, deleted };
}
