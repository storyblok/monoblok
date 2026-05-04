import { readdir } from 'node:fs/promises';
import { join } from 'pathe';
import { FileSystemError, handleFileSystemError } from '../../utils';
import type { Component, ComponentFolder, InternalTag, Preset } from './constants';
import { filterJsonBySuffix, readJsonFile } from '../../utils/filesystem';

export interface ComponentsData {
  components: Component[];
  groups: ComponentFolder[];
  presets: Preset[];
  internalTags: InternalTag[];
}

// Content-based entity discriminators — classify items by their data shape, not filename
function isComponent(item: Record<string, unknown>): item is Component {
  return 'schema' in item;
}

function isPreset(item: Record<string, unknown>): item is Preset {
  return 'component_id' in item && 'preset' in item;
}

function isInternalTag(item: Record<string, unknown>): item is InternalTag {
  return 'object_type' in item;
}

function isComponentGroup(item: Record<string, unknown>): item is ComponentFolder {
  return 'uuid' in item && !('schema' in item);
}

/**
 * Loads component entities from a directory by reading all matching JSON files
 * and classifying items by their data shape.
 *
 * Throws on duplicate components (same name found in multiple files).
 */
export async function loadComponents(
  directoryPath: string,
  options?: { suffix?: string },
): Promise<ComponentsData> {
  const files = await readdir(directoryPath);
  const { suffix } = options ?? {};

  const componentMap = new Map<string, { component: Component; file: string }>();
  const groupMap = new Map<number, ComponentFolder>();
  const tagMap = new Map<number, InternalTag>();
  const presets: Preset[] = [];
  const duplicates: string[] = [];

  for (const file of filterJsonBySuffix(files, suffix)) {
    const { data, error } = await readJsonFile<Record<string, unknown>>(join(directoryPath, file));
    if (error) {
      handleFileSystemError('read', error);
      continue;
    }

    for (const item of data) {
      if (isPreset(item)) {
        presets.push(item);
      }
      else if (isInternalTag(item)) {
        if (!item.id) {
          throw new Error('Internal tag is missing "id"!');
        }
        tagMap.set(item.id, item);
      }
      else if (isComponent(item)) {
        const existing = componentMap.get(item.name);
        if (existing) {
          duplicates.push(`Component "${item.name}" found in both "${existing.file}" and "${file}"`);
        }
        componentMap.set(item.name, { component: item, file });
      }
      else if (isComponentGroup(item)) {
        groupMap.set(item.id, item);
      }
    }
  }

  if (duplicates.length) {
    throw new FileSystemError(
      'file_not_found',
      'read',
      new Error('Duplicate components detected'),
      `Duplicate components found in ${directoryPath}:\n\n${duplicates.join('\n')}\n\nThis can happen when multiple environment snapshots (e.g. components.json and components.dev.json) or mixed formats coexist in the same directory.\n\nTo fix this, either:\n  - Use --suffix <env> to target a specific environment (e.g. --suffix dev)\n  - Clean up the directory and pull components again in the format you intend`,
    );
  }

  return {
    components: [...componentMap.values()].map(({ component }) => component),
    groups: [...groupMap.values()],
    presets,
    internalTags: [...tagMap.values()],
  };
}
