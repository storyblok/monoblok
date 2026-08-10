import type { ValidationIssue } from "./adapter";
import type { LevelOption, ValidationGroup, ValidationRunResult } from "./types";

/**
 * Applies the `--level` display threshold. `warning` shows everything; `error`
 * drops warnings. This never changes exit codes or summary totals — only which
 * issue lines are shown.
 */
export function filterIssuesByLevel(
  issues: readonly ValidationIssue[],
  level: LevelOption,
): ValidationIssue[] {
  if (level === "warning") {
    return [...issues];
  }
  return issues.filter((issue) => issue.severity === "error");
}

export interface ValidationCounts {
  errors: number;
  warnings: number;
  /**
   * Units (entities / stories) that have at least one issue, counted against the
   * same population as `unitsTotal` so `unitsTotal - unitsWithIssues` is a true
   * count of clean units.
   */
  unitsWithIssues: number;
}

/**
 * Counts how many units one group covers.
 *
 * A group is normally one unit: one story, one block, one datasource. The
 * exception is the `schema` pseudo-group. `validateSchema` attributes a nameless
 * block or a slugless datasource to `schema`, because there is no name to
 * attribute it to, so every broken-identity definition in an entry file lands in
 * that single group — counting it as one unit reports the others as clean. Its
 * issues are instead counted by the first two path segments, which locate each
 * definition by index (`blocks.0`, `datasources.1`).
 *
 * Counting per group rather than per `entity` matters for stories, where the
 * `entity` is the offending block (`block:page`) and would collapse across
 * every story that shares it.
 */
function unitsInGroup(group: ValidationGroup): number {
  if (group.ref.kind !== "schema") {
    return 1;
  }
  const definitions = new Set<string>();
  for (const issue of group.issues) {
    const [collection, index] = issue.path;
    // A schema-level issue naming no definition counts as the schema itself.
    definitions.add(
      typeof collection === "string" && index !== undefined ? `${collection}.${index}` : "schema",
    );
  }
  return definitions.size;
}

/** Counts true totals across all groups, ignoring any display filter. */
export function countIssues(result: ValidationRunResult): ValidationCounts {
  let errors = 0;
  let warnings = 0;
  let unitsWithIssues = 0;
  for (const group of result.groups) {
    for (const issue of group.issues) {
      if (issue.severity === "error") {
        errors += 1;
      } else {
        warnings += 1;
      }
    }
    unitsWithIssues += unitsInGroup(group);
  }
  return { errors, warnings, unitsWithIssues };
}
