/**
 * The `defineField` serializer, naming helpers, and coercion table the Storyblok
 * CLI shares with the snapshot generator.
 *
 * @internal Not meant for applications, but covered by semver: a published CLI
 * imports it across a version range.
 */
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
