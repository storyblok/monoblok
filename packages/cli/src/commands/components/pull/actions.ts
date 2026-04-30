import { join, resolve } from "pathe";
import type {
  Component,
  ComponentFolder,
  InternalTag,
  Preset,
  SpaceComponentsData,
} from "../constants";
import {
  DEFAULT_COMPONENTS_FILENAME,
  DEFAULT_GROUPS_FILENAME,
  DEFAULT_PRESETS_FILENAME,
  DEFAULT_TAGS_FILENAME,
} from "../constants";
import type { SaveComponentsOptions } from "./constants";
import { handleAPIError, handleFileSystemError } from "../../../utils";
import { resolvePath, sanitizeFilename, saveToFile } from "../../../utils/filesystem";
import { fetchAllPages } from "../../../utils/pagination";
import { getMapiClient } from "../../../api";

// Components
export const fetchComponents = async (spaceId: string): Promise<Component[] | undefined> => {
  try {
    const client = getMapiClient();
    return await fetchAllPages(
      (page: number) =>
        client.components.list({
          path: {
            space_id: Number(spaceId),
          },
          query: {
            page,
          },
          throwOnError: true,
        }),
      (data) => data?.components ?? [],
    );
  } catch (error) {
    handleAPIError("pull_components", error as Error);
  }
};

export const fetchComponent = async (
  spaceId: string,
  componentName: string,
): Promise<Component | undefined> => {
  try {
    const client = getMapiClient();
    const matches = await fetchAllPages(
      (page: number) =>
        client.components.list({
          path: {
            space_id: Number(spaceId),
          },
          query: {
            page,
            search: componentName,
          },
          throwOnError: true,
        }),
      (data) => data?.components ?? [],
    );
    return matches.find((c: Component) => c.name === componentName);
  } catch (error) {
    handleAPIError("pull_components", error as Error, `Failed to fetch component ${componentName}`);
  }
};

// Component group actions
export const fetchComponentGroups = async (
  spaceId: string,
): Promise<ComponentFolder[] | undefined> => {
  try {
    const client = getMapiClient();

    const { data } = await client.componentFolders.list({
      path: {
        space_id: Number(spaceId),
      },
    });

    return data?.component_groups;
  } catch (error) {
    handleAPIError("pull_component_groups", error as Error);
  }
};

// Component preset actions
export const fetchComponentPresets = async (spaceId: string): Promise<Preset[] | undefined> => {
  try {
    const client = getMapiClient();

    const { data } = await client.presets.list({
      path: {
        space_id: Number(spaceId),
      },
    });

    return data?.presets;
  } catch (error) {
    handleAPIError("pull_component_presets", error as Error);
  }
};

// Component internal tags
export const fetchComponentInternalTags = async (
  spaceId: string,
): Promise<InternalTag[] | undefined> => {
  try {
    const client = getMapiClient();
    return await fetchAllPages(
      (page: number) =>
        client.internalTags.list({
          path: {
            space_id: Number(spaceId),
          },
          query: {
            page,
            by_object_type: "component",
          },
          throwOnError: true,
        }),
      (data) => data?.internal_tags ?? [],
    );
  } catch (error) {
    handleAPIError("pull_component_internal_tags", error as Error);
  }
};

// Filesystem actions

export const saveComponentsToFiles = async (
  space: string,
  spaceData: SpaceComponentsData,
  options: SaveComponentsOptions,
) => {
  const { components = [], groups = [], presets = [], internalTags = [] } = spaceData;
  const { filename = DEFAULT_COMPONENTS_FILENAME, suffix, path, separateFiles } = options;
  // Ensure we always include the components/space folder structure regardless of custom path
  const resolvedPath = path
    ? resolve(process.cwd(), path, "components", space)
    : resolvePath(path, `components/${space}`);

  try {
    if (separateFiles) {
      // Save in separate files without nested structure
      for (const component of components) {
        const sanitizedName = sanitizeFilename(component.name || "");
        const componentFilePath = join(
          resolvedPath,
          suffix ? `${sanitizedName}.${suffix}.json` : `${sanitizedName}.json`,
        );
        await saveToFile(componentFilePath, JSON.stringify(component, null, 2));

        // Find and save associated presets
        const componentPresets = presets.filter((preset) => preset.component_id === component.id);
        if (componentPresets.length > 0) {
          const presetsFilePath = join(
            resolvedPath,
            suffix
              ? `${sanitizedName}.${DEFAULT_PRESETS_FILENAME}.${suffix}.json`
              : `${sanitizedName}.${DEFAULT_PRESETS_FILENAME}.json`,
          );
          await saveToFile(presetsFilePath, JSON.stringify(componentPresets, null, 2));
        }
        // Always save groups in a consolidated file
        const groupsFilePath = join(
          resolvedPath,
          suffix ? `${DEFAULT_GROUPS_FILENAME}.${suffix}.json` : `${DEFAULT_GROUPS_FILENAME}.json`,
        );
        await saveToFile(groupsFilePath, JSON.stringify(groups, null, 2));

        // Always save internal tags in a consolidated file
        const internalTagsFilePath = join(
          resolvedPath,
          suffix ? `${DEFAULT_TAGS_FILENAME}.${suffix}.json` : `${DEFAULT_TAGS_FILENAME}.json`,
        );
        await saveToFile(internalTagsFilePath, JSON.stringify(internalTags, null, 2));
      }
      return;
    }

    // Default to saving consolidated files
    const componentsFilePath = join(
      resolvedPath,
      suffix ? `${filename}.${suffix}.json` : `${filename}.json`,
    );
    await saveToFile(componentsFilePath, JSON.stringify(components, null, 2));

    if (groups.length > 0) {
      const groupsFilePath = join(
        resolvedPath,
        suffix ? `${DEFAULT_GROUPS_FILENAME}.${suffix}.json` : `${DEFAULT_GROUPS_FILENAME}.json`,
      );
      await saveToFile(groupsFilePath, JSON.stringify(groups, null, 2));
    }

    if (presets.length > 0) {
      const presetsFilePath = join(
        resolvedPath,
        suffix ? `${DEFAULT_PRESETS_FILENAME}.${suffix}.json` : `${DEFAULT_PRESETS_FILENAME}.json`,
      );
      await saveToFile(presetsFilePath, JSON.stringify(presets, null, 2));
    }

    if (internalTags.length > 0) {
      const internalTagsFilePath = join(
        resolvedPath,
        suffix ? `${DEFAULT_TAGS_FILENAME}.${suffix}.json` : `${DEFAULT_TAGS_FILENAME}.json`,
      );
      await saveToFile(internalTagsFilePath, JSON.stringify(internalTags, null, 2));
    }
  } catch (error) {
    handleFileSystemError("write", error as Error);
  }
};
