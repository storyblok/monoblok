import { unlink } from 'node:fs/promises';
import { join } from 'pathe';

import type { Logger } from '../../../lib/logger/logger';
import type { UI } from '../../../utils/ui';
import { directories } from '../../../constants';
import { fileExists, resolveCommandPath, sanitizeFilename, saveToFile } from '../../../utils/filesystem';
import type { DiffResult, SchemaData } from '../types';
import { displayPath } from '../utils';

const DEFAULT_GROUPS_FILENAME = 'groups.json';
const CONSOLIDATED_COMPONENTS_FILENAME = 'components.json';

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
    await saveToFile(filePath, JSON.stringify(component, null, 2));
  }

  // Component groups are not managed by the schema package (blocks are pushed
  // flat), so remove any stale groups file left by an earlier version.
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
