import { readFile } from 'node:fs/promises';
import { join } from 'pathe';
import chalk from 'chalk';
import { createTwoFilesPatch } from 'diff';

import type { ChangesetData, ChangesetEntry, RemoteSchemaData } from '../types';
import { applyDefaults, COMPONENT_DEFAULTS, isRecord } from '../utils';
import { serializeComponent, serializeDatasource } from '../serialize';
import { getMapiClient } from '../../../api';
import { handleAPIError } from '../../../utils';
import { fileExists, readDirectory } from '../../../utils/filesystem';
import { toComponentCreate, toComponentUpdate, toDatasourceCreate, toDatasourceUpdate } from '../transform';
import { buildGroupPathByUuid } from '../folders';

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
  type: 'component' | 'datasource' | 'folder';
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
    folder: [],
    component: [],
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
    ['Folders', byType.folder],
    ['Components', byType.component],
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
        else if (entry.type === 'datasource') {
          fromStr = serializeDatasource(entry.after);
          toStr = serializeDatasource(entry.before);
        }
        else {
          continue;
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

/** A resolved component group: its numeric id and server uuid. */
interface GroupRef { id: number; uuid: string }

/**
 * Builds a `slug path → { id, uuid }` map from the live remote component groups.
 *
 * Duplicated (intentionally, kept small) from `push/actions.ts`'s
 * `buildGroupByPath` so rollback stays decoupled from the push module; both walk
 * the same `buildGroupPathByUuid` output.
 */
function buildGroupRefByPath(remote: RemoteSchemaData): Map<string, GroupRef> {
  const folders = [...remote.componentFolders.values()];
  const pathByUuid = buildGroupPathByUuid(folders);
  const byPath = new Map<string, GroupRef>();
  for (const folder of folders) {
    const segments = pathByUuid.get(folder.uuid);
    if (segments?.length) { byPath.set(segments.join('/'), { id: folder.id, uuid: folder.uuid }); }
  }
  return byPath;
}

/** The parent slug path of a folder path, or `null` for a root folder. */
function parentPathOf(path: string): string | null {
  const segments = path.split('/');
  return segments.length > 1 ? segments.slice(0, -1).join('/') : null;
}

/**
 * Remaps a snapshot's stored component group uuids to their live equivalents.
 *
 * When a rollback recreates a folder the Management API assigns it a *new* uuid,
 * so a component's stored `component_group_uuid` (and any field's
 * `component_group_whitelist`) from the pre-push snapshot would otherwise point
 * at a group that no longer exists. `uuidMap` (old uuid → new uuid) is populated
 * as folders are recreated; entries not in the map (groups this push never
 * touched) are left as-is.
 */
function remapGroupUuids(payload: Record<string, unknown>, uuidMap: Map<string, string>): Record<string, unknown> {
  if (uuidMap.size === 0) { return payload; }
  const result = { ...payload };
  if (typeof result.component_group_uuid === 'string') {
    result.component_group_uuid = uuidMap.get(result.component_group_uuid) ?? result.component_group_uuid;
  }
  if (isRecord(result.schema)) {
    const schema: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(result.schema)) {
      if (isRecord(field) && Array.isArray(field.component_group_whitelist)) {
        schema[key] = {
          ...field,
          component_group_whitelist: field.component_group_whitelist.map(uuid =>
            (typeof uuid === 'string' ? uuidMap.get(uuid) ?? uuid : uuid)),
        };
      }
      else {
        schema[key] = field;
      }
    }
    result.schema = schema;
  }
  return result;
}

/**
 * Applies rollback ops to the MAPI in dependency-safe order:
 * 1. Folder creates (parent-first) — recreated groups get new uuids, tracked in
 *    an old→new map so restored components can be remapped onto them.
 * 2. Component creates/updates (group uuids remapped via that map)
 * 3. Datasource creates/updates
 * 4. Datasource deletes
 * 5. Component deletes
 * 6. Folder deletes (children-first) — after no component references them.
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

  const componentOps = ops.filter(op => op.type === 'component');
  const datasourceOps = ops.filter(op => op.type === 'datasource');
  const folderOps = ops.filter(op => op.type === 'folder');

  // Live group state (path → { id, uuid }), grown as folders are recreated, plus
  // an old→new uuid map so restored components point at the recreated groups.
  const groupRefByPath = buildGroupRefByPath(remote);
  const groupUuidMap = new Map<string, string>();

  // 1. Folder creates (parent-first): recreate groups the push deleted. Each
  //    gets a fresh server uuid; record old→new so components can be remapped.
  const folderCreates = folderOps
    .filter(o => o.action === 'create')
    .sort((a, b) => a.name.split('/').length - b.name.split('/').length);
  for (const op of folderCreates) {
    const existing = groupRefByPath.get(op.name);
    const oldUuid = typeof op.payload.uuid === 'string' ? op.payload.uuid : undefined;
    // Idempotent: if the group already exists (e.g. a re-run), reuse it instead
    // of creating a duplicate — but still record the uuid remap.
    if (existing) {
      if (oldUuid) { groupUuidMap.set(oldUuid, existing.uuid); }
      continue;
    }
    const parentPath = parentPathOf(op.name);
    const parentId = parentPath ? groupRefByPath.get(parentPath)?.id ?? null : null;
    const name = typeof op.payload.name === 'string' ? op.payload.name : op.name.split('/').pop() ?? op.name;
    try {
      const res = await client.componentFolders.create({
        path: { space_id: spaceIdNum },
        body: { component_group: { name, parent_id: parentId } },
        throwOnError: true,
      });
      const group = res.data?.component_group;
      if (group?.id != null && group.uuid) {
        groupRefByPath.set(op.name, { id: group.id, uuid: group.uuid });
        if (oldUuid) { groupUuidMap.set(oldUuid, group.uuid); }
        created++;
      }
    }
    catch (error) {
      handleAPIError('push_component_folder', error as Error, `Failed to recreate folder ${op.name}`);
    }
  }

  // 2. Component creates/updates
  for (const op of componentOps.filter(o => o.action !== 'delete')) {
    if (op.action === 'create') {
      const payload = toComponentCreate(remapGroupUuids(stripApiFields(op.payload), groupUuidMap));
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
        const payload = toComponentUpdate(remapGroupUuids(stripApiFields(op.payload), groupUuidMap));
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

  // 3. Datasource creates/updates
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

  // 4. Datasource deletes
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

  // 5. Component deletes
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
        handleAPIError('delete_component', error as Error, `Failed to delete component ${op.name}`);
      }
    }
  }

  // 6. Folder deletes (children-first): remove groups the push created, now that
  //    every component has been restored off them. Ids come from the live remote
  //    (grown with any groups recreated above).
  const folderDeletes = folderOps
    .filter(o => o.action === 'delete')
    .sort((a, b) => b.name.split('/').length - a.name.split('/').length);
  for (const op of folderDeletes) {
    const ref = groupRefByPath.get(op.name);
    if (!ref) { continue; }
    try {
      await client.componentFolders.delete(ref.id, {
        path: { space_id: spaceIdNum },
        throwOnError: true,
      });
      deleted++;
    }
    catch (error) {
      handleAPIError('delete_component_folder', error as Error, `Failed to delete folder ${op.name}`);
    }
  }

  return { created, updated, deleted };
}
