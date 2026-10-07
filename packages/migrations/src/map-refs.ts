import { mapStoryRefs } from "@storyblok/utils/content-refs";
import type { Component, Story } from "./types";

export interface RefMaps {
  assets?: Map<unknown, string | number>;
  stories?: Map<unknown, string | number>;
}

export type ComponentSchemas = Record<string, Record<string, { type: string; source?: string }>>;

export interface MapRefsOptions {
  schemas: ComponentSchemas;
  maps: RefMaps;
}

type FieldSchema = ComponentSchemas[string][string];
type ProcessedFields = Set<FieldSchema>;
type MissingSchemas = Set<Component["name"]>;

export function mapRefs(
  story: Story,
  options: MapRefsOptions,
): {
  mappedStory: Story;
  processedFields: ProcessedFields;
  missingSchemas: MissingSchemas;
} {
  const { schemas, maps } = options;
  const {
    story: mappedStory,
    processedFields,
    missingSchemas,
  } = mapStoryRefs(story, {
    schemas,
    stories: maps.stories,
    mapAsset: (asset, assetId) => {
      const newId = maps.assets?.get(assetId);
      return newId === undefined ? asset : { ...asset, id: newId };
    },
  });

  return { mappedStory, processedFields, missingSchemas };
}
