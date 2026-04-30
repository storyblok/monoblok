import type { Component } from "../components/constants";
import type { Story } from "./constants";
import type { AssetMap } from "../assets/types";
import { normalizeAssetUrl } from "@storyblok/management-api-client";

export interface RefMaps {
  assets?: AssetMap;
  stories?: Map<unknown, string | number>;
}

export type ComponentSchemas = Record<Component["name"], Component["schema"]>;

type RefMapper = <const T extends Record<string, unknown>>(
  data: T,
  options: {
    schema: Component["schema"];
    schemas: ComponentSchemas;
    maps: RefMaps;
    fieldRefMappers: FieldRefMappers;
  },
) => T;

type FieldRefMappers = Record<string, RefMapper>;

const traverseAndMapBySchema = (
  data: any,
  {
    schemas,
    maps,
    fieldRefMappers,
  }: {
    schemas: ComponentSchemas;
    maps: RefMaps;
    fieldRefMappers: FieldRefMappers;
  },
): any => {
  if (!data?.component) {
    return data ?? {};
  }
  const schema = schemas[data.component];
  if (!schema) {
    return data;
  }
  const dataNew = { ...data };

  for (const [fieldName, fieldValue] of Object.entries(data)) {
    const fieldSchema = schema[fieldName.replace(/__i18n__.*/, "")] as Component["schema"];
    const fieldType =
      fieldSchema && typeof fieldSchema === "object" && "type" in fieldSchema && fieldSchema.type;
    const fieldRefMapper = typeof fieldType === "string" && fieldRefMappers[fieldType];

    if (fieldRefMapper) {
      dataNew[fieldName] = fieldRefMapper(fieldValue as any, {
        schema: fieldSchema,
        schemas,
        maps,
        fieldRefMappers,
      });
    }
  }

  return dataNew;
};

const traverseAndMapRichtextDoc = (
  data: any,
  {
    schemas,
    maps,
    fieldRefMappers,
  }: {
    schemas: ComponentSchemas;
    maps: RefMaps;
    fieldRefMappers: FieldRefMappers;
  },
): any => {
  if (Array.isArray(data)) {
    return data.map((item) =>
      traverseAndMapRichtextDoc(item, {
        schemas,
        maps,
        fieldRefMappers,
      }),
    );
  }

  if (data && typeof data === "object") {
    if (data.type === "link" && data.attrs?.linktype === "story") {
      return {
        ...data,
        attrs: {
          ...data.attrs,
          uuid: maps.stories?.get(data.attrs.uuid) || data.attrs.uuid,
        },
      };
    }
    if (data.type === "blok") {
      return {
        ...data,
        attrs: {
          ...data.attrs,
          body: (data.attrs?.body ?? []).map((d: any) =>
            traverseAndMapBySchema(d, {
              schemas,
              maps,
              fieldRefMappers,
            }),
          ),
        },
      };
    }

    const newData: any = {};
    for (const [k, value] of Object.entries(data)) {
      newData[k] = traverseAndMapRichtextDoc(value, {
        schemas,
        maps,
        fieldRefMappers,
      });
    }
    return newData;
  }

  return data;
};

/**
 * Richtext field reference mapper.
 */
const richtextFieldRefMapper: RefMapper = (data, { schemas, maps, fieldRefMappers }) =>
  traverseAndMapRichtextDoc(data, {
    schemas,
    maps,
    fieldRefMappers,
  });

/**
 * Multilink field reference mapper.
 */
const multilinkFieldRefMapper: RefMapper = (data, { maps }) => {
  if (data.linktype !== "story") {
    return data;
  }

  return {
    ...data,
    id: maps.stories?.get(data.id) || data.id,
  };
};

/**
 * Bloks field reference mapper.
 */
const bloksFieldRefMapper: RefMapper = (data, { schemas, maps, fieldRefMappers }) => {
  if (!Array.isArray(data)) {
    throw new TypeError(
      `Invalid bloks field: expected an array, but received ${JSON.stringify(data)}. Please make sure your bloks field value is an array of components (e.g. [{ component: "my_blok", ... }]).`,
    );
  }

  return data.map((d: any) =>
    traverseAndMapBySchema(d, {
      schemas,
      maps,
      fieldRefMappers,
    }),
  ) as any;
};

/**
 * Asset field reference mapper.
 *
 * Normalizes asset filenames from S3 origin URLs to CDN URLs. The MAPI returns
 * asset filenames as S3 URLs (https://s3.amazonaws.com/a.storyblok.com/f/...)
 * but story content must reference the CDN URL (https://a.storyblok.com/f/...)
 * so that the Storyblok Image Service (/m/...) works correctly.
 */
const assetFieldRefMapper: RefMapper = (data, { maps }) => {
  const mappedAsset = typeof data.id === "number" ? maps.assets?.get(data.id) : undefined;

  if (!mappedAsset) {
    return data;
  }

  return {
    ...data,
    ...mappedAsset.new,
    filename: normalizeAssetUrl(mappedAsset.new.filename),
  };
};

/**
 * Multi asset field reference mapper.
 */
const multiassetFieldRefMapper: RefMapper = (data, options) => {
  if (!Array.isArray(data)) {
    throw new TypeError(
      `Invalid multiasset field: expected an array, but received ${JSON.stringify(data)}. Please make sure your multiasset field value is an array of asset objects (e.g. [{ filename: "...", id: 123 }]).`,
    );
  }

  return data.map((d: any) => assetFieldRefMapper(d, options)) as any;
};

/**
 * Options field reference mapper.
 */
const optionsFieldRefMapper: RefMapper = (data, { schema, maps }) => {
  if (schema.source !== "internal_stories" || !Array.isArray(data)) {
    return data;
  }

  return data.map((d: any) => maps.stories?.get(d) || d) as any;
};

const fieldRefMappers = {
  asset: assetFieldRefMapper,
  bloks: bloksFieldRefMapper,
  multiasset: multiassetFieldRefMapper,
  multilink: multilinkFieldRefMapper,
  options: optionsFieldRefMapper,
  richtext: richtextFieldRefMapper,
} as const;

/**
 * Story field reference mapper.
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
  const alternates = story.alternates
    ? (story.alternates as Required<Story>["alternates"]).map((a: any) => ({
        ...a,
        id: maps.stories?.get(a.id) ?? a.id,
        parent_id: maps.stories?.get(a.parent_id) ?? a.parent_id,
      }))
    : story.alternates;

  const parentId = maps.stories?.get(story.parent_id) ?? story.parent_id;
  return {
    ...story,
    content: story.content?.component
      ? traverseAndMapBySchema(story.content, {
          schemas,
          maps,
          fieldRefMappers,
        })
      : story.content,
    id: Number(maps.stories?.get(story.id) ?? story.id),
    uuid: String(maps.stories?.get(story.uuid) ?? story.uuid),
    parent_id: parentId != null ? Number(parentId) : 0,
    alternates,
  } satisfies Story;
};
