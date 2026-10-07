/**
 * TypeScript source generation for schema modules, `.before.ts` snapshots, and
 * `defineMigration` files. Functions return source strings; writing them is the
 * caller's concern, so importing this module works in any runtime.
 */
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
