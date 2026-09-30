/**
 * Validation issue codes the analysis attributes to a schema change. Allow-list
 * and option-list violations (`disallowed_component`, `unknown_option`) are
 * deliberately excluded: Storyblok tolerates a nested blok or an option value
 * that the schema no longer lists, so narrowing either does not break existing
 * content, and `analyzeBreakingChanges` does not treat those edits as breaking.
 * Counting them here would contradict the command's documented scope.
 */
export const ATTRIBUTED_ISSUE_CODES: ReadonlySet<string> = new Set([
  "constraint_violation",
  "invalid_content",
  "invalid_value",
  "missing_required_field",
  "unknown_field",
]);

export interface SchemaAffectedOptions {
  space?: string;
  path?: string;
  /** Analyze locally pulled story JSON files (default stories directory) instead of fetching remote. */
  local?: boolean;
  /** Treat remote-only components as deleted, mirroring `schema push --delete`. */
  includeDeleted?: boolean;
  /** Exit with a non-zero code when any story would break (for CI gating). */
  failOnBreak?: boolean;
}
