import { asArray, asRecord, isRecord, type UnknownRecord } from "../guards";

/** Maps source-space story ids and uuids to their target-space counterparts. */
export type StoryRefMap = ReadonlyMap<unknown, string | number>;

/** Field schemas keyed by field name, per component name. */
export type ComponentFieldSchemas<TFieldSchema extends object> = Record<
  string,
  Record<string, TFieldSchema> | undefined
>;

export interface MapStoryRefsOptions<TFieldSchema extends object> {
  schemas: ComponentFieldSchemas<TFieldSchema>;
  stories?: StoryRefMap;
  /**
   * Remaps an asset field value that has a numeric `id`. The returned value
   * replaces the asset in the content.
   */
  mapAsset: (asset: UnknownRecord, assetId: number) => unknown;
  /**
   * When set, `parent_id` always ends up a number: a root story (no
   * `parent_id`) gets this value, and an unmapped one is coerced. When omitted,
   * an unmapped `parent_id` is left untouched.
   */
  parentIdFallback?: number;
}

export interface StoryRefFields {
  id?: unknown;
  uuid?: unknown;
  parent_id?: unknown;
  content?: unknown;
  alternates?: unknown;
}

export interface MapStoryRefsResult<TStory, TFieldSchema extends object> {
  story: TStory;
  /** Every field schema that matched a field in the content. */
  processedFields: Set<TFieldSchema>;
  /** Component names found in the content that have no schema. */
  missingSchemas: Set<string>;
}

type TraversalContext<TFieldSchema extends object> = MapStoryRefsOptions<TFieldSchema> &
  Pick<MapStoryRefsResult<unknown, TFieldSchema>, "processedFields" | "missingSchemas">;

type FieldRefMapper = <TFieldSchema extends object>(
  value: unknown,
  fieldSchema: TFieldSchema,
  context: TraversalContext<TFieldSchema>,
) => unknown;

const I18N_FIELD_SUFFIX = /__i18n__.*/;

const mapStoryRef = (value: unknown, stories: StoryRefMap | undefined): unknown =>
  stories?.get(value) ?? value;

const mapBlok = <TFieldSchema extends object>(
  data: unknown,
  context: TraversalContext<TFieldSchema>,
): unknown => {
  if (!isRecord(data) || typeof data.component !== "string") {
    return data ?? {};
  }

  const schema = context.schemas[data.component];
  if (!schema) {
    context.missingSchemas.add(data.component);
    return data;
  }

  const mapped: UnknownRecord = { ...data };
  for (const [fieldName, fieldValue] of Object.entries(data)) {
    const fieldSchema: TFieldSchema | undefined = schema[fieldName.replace(I18N_FIELD_SUFFIX, "")];
    if (!fieldSchema) {
      continue;
    }
    context.processedFields.add(fieldSchema);

    const fieldType =
      typeof fieldSchema === "object" && "type" in fieldSchema ? fieldSchema.type : undefined;
    const fieldRefMapper =
      typeof fieldType === "string" ? FIELD_REF_MAPPERS.get(fieldType) : undefined;
    if (fieldRefMapper) {
      mapped[fieldName] = fieldRefMapper(fieldValue, fieldSchema, context);
    }
  }

  return mapped;
};

const mapRichtextNode = <TFieldSchema extends object>(
  data: unknown,
  context: TraversalContext<TFieldSchema>,
): unknown => {
  if (Array.isArray(data)) {
    return data.map((item) => mapRichtextNode(item, context));
  }

  if (!isRecord(data)) {
    return data;
  }

  const attrs = asRecord(data.attrs);
  if (data.type === "link" && attrs.linktype === "story") {
    return { ...data, attrs: { ...attrs, uuid: mapStoryRef(attrs.uuid, context.stories) } };
  }

  if (data.type === "blok") {
    return {
      ...data,
      attrs: { ...attrs, body: asArray(attrs.body).map((blok) => mapBlok(blok, context)) },
    };
  }

  const mapped: UnknownRecord = {};
  for (const [key, value] of Object.entries(data)) {
    mapped[key] = mapRichtextNode(value, context);
  }
  return mapped;
};

const mapAssetField: FieldRefMapper = (value, _fieldSchema, context) =>
  isRecord(value) && typeof value.id === "number" ? context.mapAsset(value, value.id) : value;

/**
 * An option field only holds a cross-space reference when its source is
 * `internal_stories`: the value is then a story uuid (or id, with `use_uuid`
 * off), which differs per space. Every other source is space-independent, so
 * remapping it would corrupt the value: `self` holds the inline option's own
 * `value`, `internal` and `external` hold a datasource entry's `value`, and
 * `internal_languages` holds a language code.
 */
const mapOptionValue = (value: unknown, fieldSchema: object, stories: StoryRefMap | undefined) =>
  "source" in fieldSchema && fieldSchema.source === "internal_stories"
    ? mapStoryRef(value, stories)
    : value;

const FIELD_REF_MAPPERS = new Map<string, FieldRefMapper>([
  ["asset", mapAssetField],
  [
    "bloks",
    (value, _fieldSchema, context) => {
      if (!Array.isArray(value)) {
        throw new TypeError(
          `Invalid bloks field: expected an array, but received ${JSON.stringify(value)}. Please make sure your bloks field value is an array of components (e.g. [{ component: "my_blok", ... }]).`,
        );
      }
      return value.map((blok) => mapBlok(blok, context));
    },
  ],
  [
    "multiasset",
    (value, fieldSchema, context) => {
      if (!Array.isArray(value)) {
        throw new TypeError(
          `Invalid multiasset field: expected an array, but received ${JSON.stringify(value)}. Please make sure your multiasset field value is an array of asset objects (e.g. [{ filename: "...", id: 123 }]).`,
        );
      }
      return value.map((asset) => mapAssetField(asset, fieldSchema, context));
    },
  ],
  [
    "multilink",
    (value, _fieldSchema, { stories }) =>
      isRecord(value) && value.linktype === "story"
        ? { ...value, id: mapStoryRef(value.id, stories) }
        : value,
  ],
  ["option", (value, fieldSchema, { stories }) => mapOptionValue(value, fieldSchema, stories)],
  [
    "options",
    (value, fieldSchema, { stories }) =>
      Array.isArray(value)
        ? value.map((option) => mapOptionValue(option, fieldSchema, stories))
        : value,
  ],
  ["richtext", (value, _fieldSchema, context) => mapRichtextNode(value, context)],
]);

const mapParentId = (
  parentId: unknown,
  stories: StoryRefMap | undefined,
  fallback: number | undefined,
): unknown => {
  const mappedParentId = stories?.get(parentId);
  if (mappedParentId !== undefined) {
    return Number(mappedParentId);
  }
  if (fallback === undefined) {
    return parentId;
  }
  return parentId != null ? Number(parentId) : fallback;
};

/**
 * Rewrites every source-space story and asset reference in a story, its
 * content and its alternates to the target space, following the component
 * schemas to find reference fields.
 */
export function mapStoryRefs<TStory extends StoryRefFields, TFieldSchema extends object>(
  story: TStory,
  options: MapStoryRefsOptions<TFieldSchema>,
): MapStoryRefsResult<TStory, TFieldSchema> {
  const context: TraversalContext<TFieldSchema> = {
    ...options,
    processedFields: new Set(),
    missingSchemas: new Set(),
  };
  const { stories } = options;

  const alternates = Array.isArray(story.alternates)
    ? story.alternates.map((alternate) => {
        const record = asRecord(alternate);
        return {
          ...record,
          id: mapStoryRef(record.id, stories),
          parent_id: mapStoryRef(record.parent_id, stories),
        };
      })
    : story.alternates;

  const content =
    isRecord(story.content) && story.content.component
      ? mapBlok(story.content, context)
      : story.content;

  return {
    story: {
      ...story,
      content,
      id: Number(mapStoryRef(story.id, stories)),
      uuid: String(mapStoryRef(story.uuid, stories)),
      parent_id: mapParentId(story.parent_id, stories, options.parentIdFallback),
      alternates,
    },
    processedFields: context.processedFields,
    missingSchemas: context.missingSchemas,
  };
}
