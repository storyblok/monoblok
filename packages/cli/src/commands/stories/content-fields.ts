import type { Component } from "../components/constants";

/** A single field definition within a component's wire `schema` record. */
export type SchemaFieldDefinition = NonNullable<Component["schema"]>[string];

/**
 * Field-level rules shared by everything that reads story content against its
 * component schema (reference mapping on push, reference checking on find).
 *
 * They live here rather than in either caller because getting them subtly
 * different is what produces the quiet bugs: a field missed because of its
 * translation suffix, or a relation field not recognised as one.
 */

/**
 * Strips the `__i18n__<lang>` suffix that a field-level translation carries.
 *
 * With field-level translation a `link` field also appears as `link__i18n__de`,
 * `link__i18n__fr`, and so on. Those keys hold the same kind of value as the
 * original, but the component schema only defines the base name, so any
 * schema lookup has to normalize first or it silently skips every translation.
 */
export const baseFieldName = (fieldName: string): string => fieldName.replace(/__i18n__.*/, "");

/** The schema `source` marking a field whose values are story references. */
export const INTERNAL_STORIES_SOURCE = "internal_stories";

/** True when a field draws its values from other stories rather than a datasource. */
export const isInternalStoriesSource = (field: SchemaFieldDefinition | undefined): boolean =>
  Boolean(
    field &&
    typeof field === "object" &&
    "source" in field &&
    field.source === INTERNAL_STORIES_SOURCE,
  );

/**
 * True when a schema field holds references to other stories.
 *
 * Both the single (`option`) and multi (`options`) variants qualify: the field
 * type only decides whether the value is a uuid or an array of them.
 */
export const isStoryRelationField = (field: SchemaFieldDefinition | undefined): boolean => {
  if (!field || typeof field !== "object" || !("type" in field)) {
    return false;
  }
  return (field.type === "option" || field.type === "options") && isInternalStoriesSource(field);
};
