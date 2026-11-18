/**
 * TypeScript source generation for `.before.ts` snapshots and `defineMigration`
 * files, plus the `defineField` serializer, naming helpers, coercion table, and
 * migration ids they share with the Storyblok CLI. Functions return source
 * strings, so importing this module works in any runtime.
 *
 * @internal Not meant for applications, but covered by semver: a published CLI
 * imports it across a version range.
 */
export { nextMigrationId } from "../migrations/load-migrations";
export { coercionBetween } from "../migrations/ops";
export { formatValue, INDENT, isIdentifier, quoteString, RawCode } from "./format";
export {
  collectRestrictionFolderVars,
  generateFieldCode,
  omitEmptyArrays,
  resolveTagRefs,
  sortSchemaByPos,
  stripKeys,
  toLayoutDslField,
} from "./field";
export type { TagRef } from "./field";
export { generateMigrationSource } from "./migration-source";
export type { GenerateMigrationSourceOptions, MigrationOpSource } from "./migration-source";
export { componentVarName, resolveVarNames, toCamelCaseIdentifier } from "./names";
export { generateSnapshot } from "./snapshot";
export type { GenerateSnapshotOptions, WireComponent } from "./snapshot";
