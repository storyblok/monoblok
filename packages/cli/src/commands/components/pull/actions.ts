import { join, resolve } from 'node:path';
import type { SpaceComponent, SpaceComponentFolder, SpaceComponentInternalTag, SpaceComponentPreset, SpaceComponentsData } from '../constants';
import type { SaveComponentsOptions } from './constants';
import { handleAPIError, handleFileSystemError } from '../../../utils';
import { resolvePath, sanitizeFilename, saveToFile } from '../../../utils/filesystem';
import { mapiClient } from '../../../api';

// Components
export const fetchComponents = async (spaceId: string): Promise<SpaceComponent[] | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.components.list({
      path: {
        space_id: spaceId,
      },
      throwOnError: true,
    });

    return data?.components;
  }
  catch (error) {
    handleAPIError('pull_components', error as Error);
  }
};

export const fetchComponent = async (spaceId: string, componentName: string): Promise<SpaceComponent | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.components.list({
      path: {
        space_id: spaceId,
      },
      query: {
        search: componentName,
      },
      throwOnError: true,
    });

    return data?.components?.find(c => c.name === componentName) as SpaceComponent | undefined;
  }
  catch (error) {
    handleAPIError('pull_components', error as Error, `Failed to fetch component ${componentName}`);
  }
};

// Component group actions
export const fetchComponentGroups = async (spaceId: string): Promise<SpaceComponentFolder[] | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.componentFolders.list({
      path: {
        space_id: spaceId,
      },
    });

    return data?.component_groups as SpaceComponentFolder[] | undefined;
  }
  catch (error) {
    handleAPIError('pull_component_groups', error as Error);
  }
};

// Component preset actions
export const fetchComponentPresets = async (spaceId: string): Promise<SpaceComponentPreset[] | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.presets.list({
      path: {
        space_id: spaceId,
      },
    });

    return data?.presets as SpaceComponentPreset[] | undefined;
  }
  catch (error) {
    handleAPIError('pull_component_presets', error as Error);
  }
};

// Component internal tags
export const fetchComponentInternalTags = async (spaceId: string): Promise<SpaceComponentInternalTag[] | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.internalTags.list({
      path: {
        space_id: spaceId,
      },
    });

    return data?.internal_tags?.filter(tag => tag.object_type === 'component') as SpaceComponentInternalTag[] | undefined;
  }
  catch (error) {
    handleAPIError('pull_component_internal_tags', error as Error);
  }
};

// Filesystem actions

export const saveComponentsToFiles = async (
  space: string,
  spaceData: SpaceComponentsData,
  options: SaveComponentsOptions,
) => {
  const { components = [], groups = [], presets = [], internalTags = [] } = spaceData;
  const { filename = 'components', suffix, path, separateFiles } = options;
  // Ensure we always include the components/space folder structure regardless of custom path
  const resolvedPath = path
    ? resolve(process.cwd(), path, 'components', space)
    : resolvePath(path, `components/${space}`);

  try {
    if (separateFiles) {
      // Save in separate files without nested structure
      for (const component of components) {
        const sanitizedName = sanitizeFilename(component.name || '');
        const componentFilePath = join(resolvedPath, suffix ? `${sanitizedName}.${suffix}.json` : `${sanitizedName}.json`);
        await saveToFile(componentFilePath, JSON.stringify(component, null, 2));

        // Find and save associated presets
        const componentPresets = presets.filter(preset => preset.component_id === component.id);
        if (componentPresets.length > 0) {
          const presetsFilePath = join(resolvedPath, suffix ? `${sanitizedName}.presets.${suffix}.json` : `${sanitizedName}.presets.json`);
          await saveToFile(presetsFilePath, JSON.stringify(componentPresets, null, 2));
        }
        // Always save groups in a consolidated file
        const groupsFilePath = join(resolvedPath, suffix ? `groups.${suffix}.json` : `groups.json`);
        await saveToFile(groupsFilePath, JSON.stringify(groups, null, 2));

        // Always save internal tags in a consolidated file
        const internalTagsFilePath = join(resolvedPath, suffix ? `tags.${suffix}.json` : `tags.json`);
        await saveToFile(internalTagsFilePath, JSON.stringify(internalTags, null, 2));
      }
      return;
    }

    // Default to saving consolidated files
    const componentsFilePath = join(resolvedPath, suffix ? `${filename}.${suffix}.json` : `${filename}.json`);
    await saveToFile(componentsFilePath, JSON.stringify(components, null, 2));

    if (groups.length > 0) {
      const groupsFilePath = join(resolvedPath, suffix ? `groups.${suffix}.json` : `groups.json`);
      await saveToFile(groupsFilePath, JSON.stringify(groups, null, 2));
    }

    if (presets.length > 0) {
      const presetsFilePath = join(resolvedPath, suffix ? `presets.${suffix}.json` : `presets.json`);
      await saveToFile(presetsFilePath, JSON.stringify(presets, null, 2));
    }

    if (internalTags.length > 0) {
      const internalTagsFilePath = join(resolvedPath, suffix ? `tags.${suffix}.json` : `tags.json`);
      await saveToFile(internalTagsFilePath, JSON.stringify(internalTags, null, 2));
    }
  }
  catch (error) {
    handleFileSystemError('write', error as Error);
  }
};
