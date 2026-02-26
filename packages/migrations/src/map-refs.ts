import type { Component } from '@storyblok/management-api-client/resources/components';
import type { Story } from '@storyblok/management-api-client/resources/stories';

export interface RefMaps {
  assets?: Map<unknown, string | number>;
  stories?: Map<unknown, string | number>;
  users?: Map<unknown, string | number>;
  tags?: Map<unknown, string | number>;
  datasources?: Map<unknown, string | number>;
}

export type ComponentSchemas = Record<
  string,
  Record<string, { type: string; source?: string }>
>;

export interface MapRefsOptions {
  schemas: ComponentSchemas;
  maps: RefMaps;
}

type ProcessedFields = Set<Component['schema']>;
type MissingSchemas = Set<Component['name']>;
type UnknownRecord = Record<string, unknown>;

type RefMapper = (
  data: unknown,
  options: {
    schema: Component['schema'];
    schemas: ComponentSchemas;
    maps: RefMaps;
    fieldRefMappers: FieldRefMappers;
    processedFields: ProcessedFields;
    missingSchemas: MissingSchemas;
  },
) => unknown;

type FieldRefMappers = Record<string, RefMapper>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

const traverseAndMapBySchema = (
  data: unknown,
  {
    schemas,
    maps,
    fieldRefMappers,
    processedFields,
    missingSchemas,
  }: {
    schemas: ComponentSchemas;
    maps: RefMaps;
    fieldRefMappers: FieldRefMappers;
    processedFields: ProcessedFields;
    missingSchemas: MissingSchemas;
  },
): unknown => {
  if (!isRecord(data) || typeof data.component !== 'string') {
    return data ?? {};
  }

  const schema = schemas[data.component];
  if (!schema) {
    missingSchemas.add(data.component);
    return data;
  }

  const dataNew: UnknownRecord = { ...data };

  for (const [fieldName, fieldValue] of Object.entries(data)) {
    const fieldSchema = schema[
      fieldName.replace(/__i18n__.*/, '')
    ] as Component['schema'];
    const fieldType
      = fieldSchema
        && typeof fieldSchema === 'object'
        && 'type' in fieldSchema
        && fieldSchema.type;
    const fieldRefMapper
      = typeof fieldType === 'string' && fieldRefMappers[fieldType];

    if (fieldSchema) {
      processedFields.add(fieldSchema);
    }

    if (fieldRefMapper) {
      dataNew[fieldName] = fieldRefMapper(fieldValue, {
        schema: fieldSchema,
        schemas,
        maps,
        fieldRefMappers,
        processedFields,
        missingSchemas,
      });
    }
  }

  return dataNew;
};

const traverseAndMapRichtextDoc = (
  data: unknown,
  {
    schemas,
    maps,
    fieldRefMappers,
    processedFields,
    missingSchemas,
  }: {
    schemas: ComponentSchemas;
    maps: RefMaps;
    fieldRefMappers: FieldRefMappers;
    processedFields: ProcessedFields;
    missingSchemas: MissingSchemas;
  },
): unknown => {
  if (Array.isArray(data)) {
    return data.map(item =>
      traverseAndMapRichtextDoc(item, {
        schemas,
        maps,
        fieldRefMappers,
        processedFields,
        missingSchemas,
      }),
    );
  }

  if (isRecord(data)) {
    if (data.type === 'link' && asRecord(data.attrs).linktype === 'story') {
      return {
        ...data,
        attrs: {
          ...asRecord(data.attrs),
          uuid:
            maps.stories?.get(asRecord(data.attrs).uuid)
            || asRecord(data.attrs).uuid,
        },
      };
    }

    if (data.type === 'blok') {
      return {
        ...data,
        attrs: {
          ...asRecord(data.attrs),
          body: asArray(asRecord(data.attrs).body).map(d =>
            traverseAndMapBySchema(d, {
              schemas,
              maps,
              fieldRefMappers,
              processedFields,
              missingSchemas,
            }),
          ),
        },
      };
    }

    const newData: UnknownRecord = {};
    for (const [k, value] of Object.entries(data)) {
      newData[k] = traverseAndMapRichtextDoc(value, {
        schemas,
        maps,
        fieldRefMappers,
        processedFields,
        missingSchemas,
      });
    }

    return newData;
  }

  return data;
};

const richtextFieldRefMapper: RefMapper = (
  data,
  { schemas, maps, fieldRefMappers, processedFields, missingSchemas },
) =>
  traverseAndMapRichtextDoc(data, {
    schemas,
    maps,
    fieldRefMappers,
    processedFields,
    missingSchemas,
  });

const multilinkFieldRefMapper: RefMapper = (data, { maps }) => {
  if (!isRecord(data) || data.linktype !== 'story') {
    return data;
  }

  return {
    ...data,
    id: maps.stories?.get(data.id) || data.id,
  };
};

const bloksFieldRefMapper: RefMapper = (
  data,
  { schemas, maps, fieldRefMappers, processedFields, missingSchemas },
) => {
  if (!Array.isArray(data)) {
    throw new TypeError(
      `Invalid bloks field: expected an array, but received ${JSON.stringify(data)}.`,
    );
  }

  return data.map(d =>
    traverseAndMapBySchema(d, {
      schemas,
      maps,
      fieldRefMappers,
      processedFields,
      missingSchemas,
    }),
  );
};

const assetFieldRefMapper: RefMapper = (data, { maps }) => {
  if (!isRecord(data)) {
    return data;
  }

  const newId
    = typeof data.id === 'number' ? maps.assets?.get(data.id) : undefined;
  return newId === undefined ? data : { ...data, id: newId };
};

const multiassetFieldRefMapper: RefMapper = (data, options) => {
  if (!Array.isArray(data)) {
    throw new TypeError(
      `Invalid multiasset field: expected an array, but received ${JSON.stringify(data)}.`,
    );
  }

  return data.map(d => assetFieldRefMapper(d, options));
};

const optionsFieldRefMapper: RefMapper = (data, { schema, maps }) => {
  if (!Array.isArray(data)) {
    return data;
  }

  const sourceMapBySchema: Record<
    string,
    Map<unknown, string | number> | undefined
  > = {
    internal_stories: maps.stories,
    internal_users: maps.users,
    internal_tags: maps.tags,
    internal_datasources: maps.datasources,
  };

  const sourceMap
    = sourceMapBySchema[(schema as { source?: string }).source ?? ''];
  if (!sourceMap) {
    return data;
  }

  return data.map(d => sourceMap.get(d) || d);
};

const fieldRefMappers = {
  asset: assetFieldRefMapper,
  bloks: bloksFieldRefMapper,
  multiasset: multiassetFieldRefMapper,
  multilink: multilinkFieldRefMapper,
  options: optionsFieldRefMapper,
  richtext: richtextFieldRefMapper,
} as const;

export function mapRefs(
  story: Story,
  options: MapRefsOptions,
): {
    mappedStory: Story;
    processedFields: ProcessedFields;
    missingSchemas: MissingSchemas;
  } {
  const { schemas, maps } = options;
  const processedFields: ProcessedFields = new Set();
  const missingSchemas: MissingSchemas = new Set();

  const alternatesRaw = story.alternates
    ? (story.alternates as Required<Story>['alternates']).map((alternate) => {
        const mappedAlternate = asRecord(alternate);
        return {
          ...mappedAlternate,
          id: maps.stories?.get(mappedAlternate.id) ?? mappedAlternate.id,
          parent_id:
            maps.stories?.get(mappedAlternate.parent_id)
            ?? mappedAlternate.parent_id,
        };
      })
    : story.alternates;
  // mapped ids may be string|number at runtime but shape is compatible
  const alternates = alternatesRaw as Story['alternates'];

  const parentId = maps.stories?.get(story.parent_id) ?? story.parent_id;
  const mappedContentRaw = story.content?.component
    ? traverseAndMapBySchema(story.content, {
        schemas,
        maps,
        fieldRefMappers,
        processedFields,
        missingSchemas,
      })
    : story.content;

  const mappedStory = {
    ...story,
    // traverseAndMapBySchema returns unknown; runtime shape satisfies Blok
    content: mappedContentRaw as unknown as Story['content'],
    id: Number(maps.stories?.get(story.id) ?? story.id),
    uuid: String(maps.stories?.get(story.uuid) ?? story.uuid),
    parent_id: parentId === undefined ? undefined : Number(parentId),
    alternates,
  } satisfies Story;

  return {
    mappedStory,
    processedFields,
    missingSchemas,
  };
}
