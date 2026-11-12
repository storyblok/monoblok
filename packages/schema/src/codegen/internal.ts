/**
 * The `defineField` serializer, naming helpers, coercion table, and migration
 * ids the Storyblok CLI shares with the snapshot generator.
 *
 * @internal Not meant for applications, but covered by semver: a published CLI
 * imports it across a version range.
 */
export { nextMigrationId } from "../migrations/load-migrations";
export { coercionBetween } from "../migrations/ops";
export { formatValue, INDENT, quoteString, RawCode } from "./format";
export {
  collectRestrictionFolderVars,
  generateFieldCode,
  omitEmptyArrays,
  resolveTagRefs,
  sortSchemaByPos,
} from "./field";
export type { TagRef } from "./field";
export { componentVarName, resolveVarNames, toCamelCaseIdentifier } from "./names";
