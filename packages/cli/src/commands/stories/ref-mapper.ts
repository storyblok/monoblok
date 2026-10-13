import { normalizeAssetUrl } from "@storyblok/management-api-client";
import { mapStoryRefs } from "@storyblok/utils/content-refs";
import type { Component } from "../components/constants";
import type { Story } from "./constants";
import type { AssetMap } from "../assets/types";

export interface RefMaps {
  assets?: AssetMap;
  stories?: Map<unknown, string | number>;
}

export type ComponentSchemas = Record<Component["name"], Component["schema"]>;

const ROOT_PARENT_ID = 0;

/**
 * Story field reference mapper.
 *
 * Mapped assets take over the target asset's fields. The MAPI returns asset
 * filenames as S3 URLs (https://s3.amazonaws.com/a.storyblok.com/f/...) but
 * story content must reference the CDN URL (https://a.storyblok.com/f/...) so
 * that the Storyblok Image Service (/m/...) works correctly.
 */
export const storyRefMapper = (
  story: Story,
  {
    schemas,
    maps,
  }: {
    schemas: ComponentSchemas;
    maps: RefMaps;
  },
) => {
  const { story: mappedStory } = mapStoryRefs(story, {
    schemas,
    stories: maps.stories,
    parentIdFallback: ROOT_PARENT_ID,
    mapAsset: (asset, assetId) => {
      const mappedAsset = maps.assets?.get(assetId);
      if (!mappedAsset) {
        return asset;
      }
      return {
        ...asset,
        ...mappedAsset.new,
        filename: normalizeAssetUrl(mappedAsset.new.filename),
      };
    },
  });

  // The content is walked untyped, so callers index into it without narrowing.
  return { ...mappedStory, content: mappedStory.content as any };
};
