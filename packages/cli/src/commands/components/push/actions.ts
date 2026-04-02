import { FileSystemError, handleAPIError } from '../../../utils';
import type { Component, ComponentFolder, InternalTag, Preset } from '../constants';
import type { ComponentCreate, ComponentUpdate } from '../../../types';
import type { ReadComponentsOptions } from './constants';
import { resolvePath } from '../../../utils/filesystem';
import chalk from 'chalk';
import { getMapiClient } from '../../../api';
import { type ComponentsData, loadComponents } from '../loader';

export type { ComponentsData };

// Component actions
export const pushComponent = async (space: string, component: ComponentCreate): Promise<Component | undefined> => {
  try {
    const client = getMapiClient();

    const { data } = await client.components.create({
      path: {
        space_id: Number(space),
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

export const updateComponent = async (space: string, componentId: number, component: ComponentUpdate): Promise<Component | undefined> => {
  try {
    const client = getMapiClient();

    const { data } = await client.components.update(componentId, {
      path: {
        space_id: Number(space),
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
  component: ComponentCreate,
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

export const pushComponentGroup = async (space: string, componentGroup: ComponentFolder): Promise<ComponentFolder | undefined> => {
  try {
    const client = getMapiClient();

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

export const updateComponentGroup = async (space: string, groupId: number, componentGroup: ComponentFolder): Promise<ComponentFolder | undefined> => {
  try {
    const client = getMapiClient();

    const { data } = await client.componentFolders.update(groupId, {
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
    handleAPIError('update_component_group', error as Error, `Failed to update component group ${componentGroup.name}`);
  }
};

export const upsertComponentGroup = async (
  space: string,
  group: ComponentFolder,
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
export const pushComponentPreset = async (space: string, preset: Preset): Promise<Preset | undefined> => {
  try {
    const client = getMapiClient();

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

export const updateComponentPreset = async (space: string, presetId: number, preset: Preset): Promise<Preset | undefined> => {
  try {
    const client = getMapiClient();

    const { data } = await client.presets.update(presetId, {
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
    handleAPIError('update_component_preset', error as Error, `Failed to update component preset ${preset.name}`);
  }
};

export const upsertComponentPreset = async (
  space: string,
  preset: Preset,
  existingId?: number,
): Promise<Preset | undefined> => {
  if (existingId) {
    // We know it exists, update directly
    return await updateComponentPreset(space, existingId, preset);
  }
  else {
    // New resource, create directly
    return await pushComponentPreset(space, preset);
  }
};

// Component preset deletion
export const deleteComponentPreset = async (space: string, presetId: number): Promise<void> => {
  try {
    const client = getMapiClient();

    await client.presets.delete(presetId, {
      path: { space_id: Number(space) },
      throwOnError: true,
    });
  }
  catch (error) {
    handleAPIError('delete_component_preset', error as Error, `Failed to delete component preset ${presetId}`);
  }
};

// Component internal tag actions

export const pushComponentInternalTag = async (space: string, componentInternalTag: InternalTag): Promise<InternalTag | undefined> => {
  try {
    const client = getMapiClient();

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

export const updateComponentInternalTag = async (space: string, tagId: number, componentInternalTag: InternalTag): Promise<InternalTag | undefined> => {
  try {
    const client = getMapiClient();

    const { data } = await client.internalTags.update(tagId, {
      path: {
        space_id: Number(space),
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
  const { from, path, suffix } = options;
  const resolvedPath = resolvePath(path, `components/${from}`);

  let result: ComponentsData;
  try {
    result = await loadComponents(resolvedPath, { suffix });
  }
  catch (error) {
    if (error instanceof FileSystemError) {
      throw error;
    }
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

  if (!result.components.length) {
    throw new FileSystemError(
      'file_not_found',
      'read',
      new Error('No component data found'),
      `No components found in ${resolvedPath}. Please make sure you have pulled the components first.`,
    );
  }

  return result;
};
