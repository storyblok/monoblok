import { FileSystemError, handleAPIError, handleFileSystemError } from '../../../utils';
import type { SpaceComponent, SpaceComponentGroup, SpaceComponentInternalTag, SpaceComponentPreset } from '../constants';
import type { ReadComponentsOptions } from './constants';
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { readJsonFile, resolvePath } from '../../../utils/filesystem';
import chalk from 'chalk';
import { mapiClient } from '../../../api';
import type { Component } from '@storyblok/mapi-client/resources/components';
import type { ComponentFolder, ComponentFolderInput } from '@storyblok/mapi-client/resources/component_folders';
import type { Preset, PresetCreate } from '@storyblok/mapi-client/resources/presets';
import type { InternalTag } from '@storyblok/mapi-client/resources/internal_tags';
import type { MapiClient } from '@storyblok/mapi-client';

// Define a type for components data without datasources
export interface ComponentsData {
  components: SpaceComponent[];
  groups: SpaceComponentGroup[];
  presets: SpaceComponentPreset[];
  internalTags: SpaceComponentInternalTag[];
}

// Component actions
export const pushComponent = async (space: string, component: Component): Promise<Component | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.components.create({
      throwOnError: true,
      path: {
        space_id: Number(space),
      },
      body: { component },
    });

    return data.component;
  }
  catch (error) {
    handleAPIError('push_component', error as Error, `Failed to push component ${component.name}`);
  }
};

export const updateComponent = async (space: string, componentId: number, component: Component): Promise<Component | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.components.update({
      throwOnError: true,
      path: {
        space_id: Number(space),
        component_id: componentId,
      },
      body: { component },
    });
    return data.component;
  }
  catch (error) {
    handleAPIError('update_component', error as Error, `Failed to update component ${component.name}`);
  }
};

export const upsertComponent = async (
  space: string,
  component: Component,
  existingId?: number,
): Promise<Component | undefined> => {
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

export const pushComponentGroup = async (space: string, componentGroup: ComponentFolderInput): Promise<ComponentFolder | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.componentFolders.create({
      throwOnError: true,
      path: {
        space_id: Number(space),
      },
      body: { component_group: componentGroup },
    });
    return data.component_group;
  }
  catch (error) {
    handleAPIError('push_component_group', error as Error, `Failed to push component group ${componentGroup.name}`);
  }
};

export const updateComponentGroup = async (space: string, groupId: number, componentGroup: ComponentFolder): Promise<ComponentFolder | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.componentFolders.update({
      throwOnError: true,
      path: {
        space_id: Number(space),
        component_group_id: String(groupId),
      },
      body: { component_group: componentGroup },
    });
    return data.component_group;
  }
  catch (error) {
    handleAPIError('update_component_group', error as Error, `Failed to update component group ${componentGroup.name}`);
  }
};

export const upsertComponentGroup = async (
  space: string,
  group: ComponentFolderInput,
  existingId?: number,
): Promise<ComponentFolder | undefined> => {
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
export const pushComponentPreset = async (space: string, componentPreset: { preset: PresetCreate }): Promise<Preset | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.presets.create({
      throwOnError: true,
      path: {
        space_id: Number(space),
      },
      body: { preset: componentPreset.preset },
    });
    return data.preset;
  }
  catch (error) {
    handleAPIError('push_component_preset', error as Error, `Failed to push component preset ${componentPreset.preset.name}`);
  }
};

export const updateComponentPreset = async (space: string, presetId: number, componentPreset: { preset: Partial<Preset> }): Promise<Preset | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.presets.update({
      throwOnError: true,
      path: {
        space_id: Number(space),
        preset_id: presetId,
      },
      body: { preset: componentPreset },
    });
    return data.preset;
  }
  catch (error) {
    handleAPIError('update_component_preset', error as Error, `Failed to update component preset ${componentPreset.preset.name}`);
  }
};

export const upsertComponentPreset = async (
  space: string,
  preset: PresetCreate,
  existingId?: number,
): Promise<Preset | undefined> => {
  if (existingId) {
    // We know it exists, update directly
    return await updateComponentPreset(space, existingId, { preset });
  }
  else {
    // New resource, create directly
    return await pushComponentPreset(space, { preset });
  }
};

// Component internal tag actions

export const pushComponentInternalTag = async (space: string, componentInternalTag: InternalTag): Promise<InternalTag | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.internalTags.create({
      throwOnError: true,
      path: {
        space_id: Number(space),
      },
      body: componentInternalTag,
    });

    return data.internal_tag;
  }
  catch (error) {
    handleAPIError('push_component_internal_tag', error as Error, `Failed to push component internal tag ${componentInternalTag.name}`);
  }
};

export const updateComponentInternalTag = async (space: string, tagId: number, componentInternalTag: MapiClient['internalTags']['update']): Promise<InternalTag | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.internalTags.update({
      throwOnError: true,
      path: {
        space_id: Number(space),
        internal_tag_id: tagId,
      },
      body: componentInternalTag,
    });

    return data.internal_tag;
  }
  catch (error) {
    console.error(error);
    handleAPIError('update_component_internal_tag', error as Error, `Failed to update component internal tag ${componentInternalTag.name}`);
  }
};

export const upsertComponentInternalTag = async (
  space: string,
  tag: InternalTag,
  existingId?: number,
): Promise<InternalTag | undefined> => {
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
  const components: Component[] = [];
  const presets: Preset[] = [];
  let groups: ComponentFolder[] = [];
  let internalTags: InternalTag[] = [];

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

    if (file === 'groups.json' || file === `groups.${suffix}.json`) {
      const result = await readJsonFile<ComponentFolder>(filePath);
      if (result.error) {
        handleFileSystemError('read', result.error);
        continue;
      }
      groups = result.data;
    }
    else if (file === 'tags.json' || file === `tags.${suffix}.json`) {
      const result = await readJsonFile<InternalTag>(filePath);
      if (result.error) {
        handleFileSystemError('read', result.error);
        continue;
      }
      internalTags = result.data;
    }
    else if (file.endsWith('.presets.json') || file.endsWith(`.presets.${suffix}.json`)) {
      const result = await readJsonFile<Preset>(filePath);
      if (result.error) {
        handleFileSystemError('read', result.error);
        continue;
      }
      presets.push(...result.data);
    }
    else if (file.endsWith('.json') || file.endsWith(`${suffix}.json`)) {
      if (file === 'components.json' || file === `components.${suffix}.json`) {
        continue;
      }
      const result = await readJsonFile<Component>(filePath);
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
  const componentsPath = join(resolvedPath, suffix ? `components.${suffix}.json` : 'components.json');
  const componentsResult = await readJsonFile<Component>(componentsPath);

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
    readJsonFile<ComponentFolder>(join(resolvedPath, suffix ? `groups.${suffix}.json` : 'groups.json')),
    readJsonFile<Preset>(join(resolvedPath, suffix ? `presets.${suffix}.json` : 'presets.json')),
    readJsonFile<InternalTag>(join(resolvedPath, suffix ? `tags.${suffix}.json` : 'tags.json')),
  ]);

  return {
    components: componentsResult.data,
    groups: groupsResult.data,
    presets: presetsResult.data,
    internalTags: tagsResult.data,
  };
}
