import { FileSystemError, handleAPIError, handleFileSystemError } from '../../../utils';
import type { SpaceComponent, SpaceComponentFolder, SpaceComponentInternalTag, SpaceComponentPreset } from '../constants';
import { DEFAULT_COMPONENTS_FILENAME, DEFAULT_GROUPS_FILENAME, DEFAULT_PRESETS_FILENAME, DEFAULT_TAGS_FILENAME } from '../constants';
import type { ReadComponentsOptions } from './constants';
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { readJsonFile, resolvePath } from '../../../utils/filesystem';
import chalk from 'chalk';
import { mapiClient } from '../../../api';

// Define a type for components data without datasources
export interface ComponentsData {
  components: SpaceComponent[];
  groups: SpaceComponentFolder[];
  presets: SpaceComponentPreset[];
  internalTags: SpaceComponentInternalTag[];
}

// Component actions
export const pushComponent = async (space: string, component: SpaceComponent): Promise<SpaceComponent | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.components.create({
      path: {
        space_id: space,
      },
      body: {
        component,
      },
    });

    return data?.component;
  }
  catch (error) {
    handleAPIError('push_component', error as Error, `Failed to push component ${component.name}`);
  }
};

export const updateComponent = async (space: string, componentId: number, component: SpaceComponent): Promise<SpaceComponent | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.components.update({
      path: {
        space_id: Number(space),
        component_id: componentId,
      },
      body: {
        component,
      },
      throwOnError: true,
    });

    return data?.component;
  }
  catch (error) {
    handleAPIError('update_component', error as Error, `Failed to update component ${component.name}`);
  }
};

export const upsertComponent = async (
  space: string,
  component: SpaceComponent,
  existingId?: number,
): Promise<SpaceComponent | undefined> => {
  if (existingId) {
    // We know it exists, update directly
    return await updateComponent(space, existingId, component);
  }
  else {
    // New resource, create directly
    return await pushComponent(space, component);
  }
};

// Component group actions

export const pushComponentGroup = async (space: string, componentGroup: SpaceComponentFolder): Promise<SpaceComponentFolder | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.componentFolders.create({
      path: {
        space_id: Number(space),
      },
      body: {
        component_group: componentGroup,
      },
      throwOnError: true,
    });

    return data?.component_group;
  }
  catch (error) {
    handleAPIError('push_component_group', error as Error, `Failed to push component group ${componentGroup.name}`);
  }
};

export const updateComponentGroup = async (space: string, groupId: number, componentGroup: SpaceComponentFolder): Promise<SpaceComponentFolder | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.componentFolders.update({
      path: {
        space_id: Number(space),
        component_group_id: String(groupId),
      },
      body: {
        component_group: componentGroup,
      },
      throwOnError: true,
    });

    return data?.component_group;
  }
  catch (error) {
    handleAPIError('update_component_group', error as Error, `Failed to update component group ${componentGroup.name}`);
  }
};

export const upsertComponentGroup = async (
  space: string,
  group: SpaceComponentFolder,
  existingId?: number,
): Promise<SpaceComponentFolder | undefined> => {
  if (existingId) {
    // We know it exists, update directly
    return await updateComponentGroup(space, existingId, group);
  }
  else {
    // New resource, create directly
    return await pushComponentGroup(space, group);
  }
};

// Component preset actions
export const pushComponentPreset = async (space: string, preset: SpaceComponentPreset): Promise<SpaceComponentPreset | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.presets.create({
      path: {
        space_id: Number(space),
      },
      body: {
        preset,
      },
      throwOnError: true,
    });

    return data?.preset;
  }
  catch (error) {
    handleAPIError('push_component_preset', error as Error, `Failed to push component preset ${preset.name}`);
  }
};

export const updateComponentPreset = async (space: string, presetId: number, preset: SpaceComponentPreset): Promise<SpaceComponentPreset | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.presets.update({
      path: {
        space_id: Number(space),
        preset_id: presetId,
      },
      body: {
        preset,
      },
      throwOnError: true,
    });

    return data?.preset;
  }
  catch (error) {
    handleAPIError('update_component_preset', error as Error, `Failed to update component preset ${preset.name}`);
  }
};

export const upsertComponentPreset = async (
  space: string,
  preset: SpaceComponentPreset,
  existingId?: number,
): Promise<SpaceComponentPreset | undefined> => {
  if (existingId) {
    // We know it exists, update directly
    return await updateComponentPreset(space, existingId, preset);
  }
  else {
    // New resource, create directly
    return await pushComponentPreset(space, preset);
  }
};

// Component internal tag actions

export const pushComponentInternalTag = async (space: string, componentInternalTag: SpaceComponentInternalTag): Promise<SpaceComponentInternalTag | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.internalTags.create({
      path: {
        space_id: Number(space),
      },
      body: componentInternalTag,
      throwOnError: true,
    });

    return data.internal_tag;
  }
  catch (error) {
    handleAPIError('push_component_internal_tag', error as Error, `Failed to push component internal tag ${componentInternalTag.name}`);
  }
};

export const updateComponentInternalTag = async (space: string, tagId: number, componentInternalTag: SpaceComponentInternalTag): Promise<SpaceComponentInternalTag | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.internalTags.update({
      path: {
        space_id: Number(space),
        internal_tag_id: tagId,
      },
      body: componentInternalTag,
      throwOnError: true,
    });

    return data.internal_tag;
  }
  catch (error) {
    handleAPIError('update_component_internal_tag', error as Error, `Failed to update component internal tag ${componentInternalTag.name}`);
  }
};

export const upsertComponentInternalTag = async (
  space: string,
  tag: SpaceComponentInternalTag,
  existingId?: number,
): Promise<SpaceComponentInternalTag | undefined> => {
  if (existingId) {
    // We know it exists, update directly
    return await updateComponentInternalTag(space, existingId, tag);
  }
  else {
    // New resource, create directly
    return await pushComponentInternalTag(space, tag);
  }
};

export const readComponentsFiles = async (
  options: ReadComponentsOptions): Promise<ComponentsData> => {
  const { from, path, separateFiles = false, suffix } = options;
  const resolvedPath = resolvePath(path, `components/${from}`);

  // Check if directory exists first
  try {
    await readdir(resolvedPath);
  }
  catch (error) {
    const message = `No local components found for space ${chalk.bold(from)}. To push components, you need to pull them first:

1. Pull the components from your source space:
   ${chalk.cyan(`storyblok components pull --space ${from}`)}

2. Then try pushing again:
   ${chalk.cyan(`storyblok components push --space <target_space> --from ${from}`)}`;

    throw new FileSystemError(
      'file_not_found',
      'read',
      error as Error,
      message,
    );
  }

  if (separateFiles) {
    return await readSeparateFiles(resolvedPath, suffix);
  }

  return await readConsolidatedFiles(resolvedPath, suffix);
};

async function readSeparateFiles(resolvedPath: string, suffix?: string): Promise<ComponentsData> {
  const files = await readdir(resolvedPath);
  const components: SpaceComponent[] = [];
  const presets: SpaceComponentPreset[] = [];
  let groups: SpaceComponentFolder[] = [];
  let internalTags: SpaceComponentInternalTag[] = [];

  const filteredFiles = files.filter((file) => {
    if (suffix) {
      return file.endsWith(`.${suffix}.json`);
    }
    else {
      // Regex to match files with a pattern like .<suffix>.json
      return !/\.\w+\.json$/.test(file) || file.endsWith('.presets.json'); ;
    }
  });

  for (const file of filteredFiles) {
    const filePath = join(resolvedPath, file);

    if (file === `${DEFAULT_GROUPS_FILENAME}.json` || file === `${DEFAULT_GROUPS_FILENAME}.${suffix}.json`) {
      const result = await readJsonFile<SpaceComponentFolder>(filePath);
      if (result.error) {
        handleFileSystemError('read', result.error);
        continue;
      }
      groups = result.data;
    }
    else if (file === `${DEFAULT_TAGS_FILENAME}.json` || file === `${DEFAULT_TAGS_FILENAME}.${suffix}.json`) {
      const result = await readJsonFile<SpaceComponentInternalTag>(filePath);
      if (result.error) {
        handleFileSystemError('read', result.error);
        continue;
      }
      internalTags = result.data;
    }
    else if (file.endsWith(`.${DEFAULT_PRESETS_FILENAME}.json`) || file.endsWith(`.${DEFAULT_PRESETS_FILENAME}.${suffix}.json`)) {
      const result = await readJsonFile<SpaceComponentPreset>(filePath);
      if (result.error) {
        handleFileSystemError('read', result.error);
        continue;
      }
      presets.push(...result.data);
    }
    else if (file.endsWith('.json') || file.endsWith(`${suffix}.json`)) {
      if (file === `${DEFAULT_COMPONENTS_FILENAME}.json` || file === `${DEFAULT_COMPONENTS_FILENAME}.${suffix}.json`) {
        continue;
      }
      const result = await readJsonFile<SpaceComponent>(filePath);
      if (result.error) {
        handleFileSystemError('read', result.error);
        continue;
      }
      components.push(...result.data);
    }
  }

  return {
    components,
    groups,
    presets,
    internalTags,
  };
}

async function readConsolidatedFiles(resolvedPath: string, suffix?: string): Promise<ComponentsData> {
  // Read required components file
  const componentsPath = join(resolvedPath, suffix ? `${DEFAULT_COMPONENTS_FILENAME}.${suffix}.json` : `${DEFAULT_COMPONENTS_FILENAME}.json`);
  const componentsResult = await readJsonFile<SpaceComponent>(componentsPath);

  if (componentsResult.error || !componentsResult.data.length) {
    throw new FileSystemError(
      'file_not_found',
      'read',
      componentsResult.error || new Error('Components file is empty'),
      `No components found in ${componentsPath}. Please make sure you have pulled the components first.`,
    );
  }

  // Read optional files
  const [groupsResult, presetsResult, tagsResult] = await Promise.all([
    readJsonFile<SpaceComponentFolder>(join(resolvedPath, suffix ? `${DEFAULT_GROUPS_FILENAME}.${suffix}.json` : `${DEFAULT_GROUPS_FILENAME}.json`)),
    readJsonFile<SpaceComponentPreset>(join(resolvedPath, suffix ? `${DEFAULT_PRESETS_FILENAME}.${suffix}.json` : `${DEFAULT_PRESETS_FILENAME}.json`)),
    readJsonFile<SpaceComponentInternalTag>(join(resolvedPath, suffix ? `${DEFAULT_TAGS_FILENAME}.${suffix}.json` : `${DEFAULT_TAGS_FILENAME}.json`)),
  ]);

  return {
    components: componentsResult.data,
    groups: groupsResult.data,
    presets: presetsResult.data,
    internalTags: tagsResult.data,
  };
}
