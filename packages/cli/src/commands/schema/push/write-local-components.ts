import { unlink } from 'node:fs/promises';
import { join } from 'pathe';

import type { Logger } from '../../../lib/logger/logger';
import type { UI } from '../../../utils/ui';
import { directories } from '../../../constants';
import { fileExists, resolveCommandPath, sanitizeFilename, saveToFile } from '../../../utils/filesystem';
import type { Component } from '../../../types';
import type { DiffResult, SchemaData } from '../types';
import { displayPath, isRecord } from '../utils';

const DEFAULT_GROUPS_FILENAME = 'groups.json';
const CONSOLIDATED_COMPONENTS_FILENAME = 'components.json';

/**
 * Strips transient, push-time-only keys before a component is written to local
 * JSON. `folder` is an internal slug-path key that never belongs on disk, and
 * each field's `component_group_whitelist` here holds slug paths, not the group
 * uuids that local JSON consumers (e.g. `stories push` schema validation)
 * expect. Only `local` schema data reaches this function — the remote/created
 * group set needed to resolve paths → uuids is not available here — so the
 * path-space whitelist is dropped rather than written in a form no consumer can
 * use. The escape-hatch `component_group_uuid` (a real uuid) is preserved.
 *
 * A field carrying `component_group_whitelist` also has its `restrict_type:
 * 'groups'` and `restrict_components` keys dropped alongside it, so the
 * written JSON never has a group restriction with no group list left behind
 * (orphaned keys). Folder and block whitelists never coexist — the schema
 * throws on mixing — so this is safe: such a field has no `component_whitelist`.
 */
function sanitizeForLocalWrite(component: Component): Record<string, unknown> {
  const { folder, ...rest } = component as Record<string, unknown>;
  if (isRecord(rest.schema)) {
    const schema: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(rest.schema)) {
      if (isRecord(field) && 'component_group_whitelist' in field) {
        const { component_group_whitelist, restrict_components, ...fieldRest } = field;
        if (fieldRest.restrict_type === 'groups') {
          delete fieldRest.restrict_type;
        }
        schema[key] = fieldRest;
      }
      else {
        schema[key] = field;
      }
    }
    rest.schema = schema;
  }
  return rest;
}

export interface WriteLocalComponentsParams {
  space: string;
  basePath?: string;
  resolved: SchemaData;
  diffResult: DiffResult;
  deleteRemoved: boolean;
  ui: UI;
  logger: Logger;
}

export async function writeLocalComponents({
  space,
  basePath,
  resolved,
  diffResult,
  deleteRemoved,
  ui,
  logger,
}: WriteLocalComponentsParams): Promise<void> {
  const componentsDir = resolveCommandPath(directories.components, space, basePath);

  const consolidatedPath = join(componentsDir, CONSOLIDATED_COMPONENTS_FILENAME);
  if (await fileExists(consolidatedPath)) {
    ui.warn(
      `A consolidated ${CONSOLIDATED_COMPONENTS_FILENAME} exists at ${displayPath(componentsDir, basePath)}. `
      + `Per-component files will still be written, but the consolidated file may shadow them when stories push validates schemas. `
      + `Delete it or run \`storyblok components pull --separate-files\` to regenerate.`,
    );
  }

  for (const component of resolved.components) {
    const filePath = join(componentsDir, `${sanitizeFilename(component.name || '')}.json`);
    await saveToFile(filePath, JSON.stringify(sanitizeForLocalWrite(component), null, 2));
  }

  // Component group membership is managed via each block's transient `folder`
  // key (resolved to a `component_group_uuid` at push time), not a local groups
  // file. Remove any stale `groups.json` left by an earlier CLI version.
  const groupsPath = join(componentsDir, DEFAULT_GROUPS_FILENAME);
  if (await fileExists(groupsPath)) {
    try {
      await unlink(groupsPath);
      logger.info('Removed stale local groups file', { path: displayPath(groupsPath, basePath) });
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  if (deleteRemoved) {
    const staleComponents = diffResult.diffs.filter(
      d => d.type === 'component' && d.action === 'stale',
    );
    for (const stale of staleComponents) {
      const filePath = join(componentsDir, `${sanitizeFilename(stale.name)}.json`);
      try {
        await unlink(filePath);
        logger.info('Removed stale local component file', { path: displayPath(filePath, basePath) });
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    }
  }

  logger.info('Wrote local component files', {
    space,
    componentsWritten: resolved.components.length,
  });
}
