import type { ValidationIssue } from './adapter';
import type { LevelOption, ValidationRunResult } from './types';

/**
 * Applies the `--level` display threshold. `warning` shows everything; `error`
 * drops warnings. This never changes exit codes or summary totals — only which
 * issue lines are shown.
 */
export function filterIssuesByLevel(
  issues: readonly ValidationIssue[],
  level: LevelOption,
): ValidationIssue[] {
  if (level === 'warning') {
    return [...issues];
  }
  return issues.filter(issue => issue.severity === 'error');
}

export interface ValidationCounts {
  errors: number;
  warnings: number;
  /** Groups (entities / stories) that have at least one issue. */
  unitsWithIssues: number;
}

/** Counts true totals across all groups, ignoring any display filter. */
export function countIssues(result: ValidationRunResult): ValidationCounts {
  let errors = 0;
  let warnings = 0;
  for (const group of result.groups) {
    for (const issue of group.issues) {
      if (issue.severity === 'error') {
        errors += 1;
      }
      else {
        warnings += 1;
      }
    }
  }
  return { errors, warnings, unitsWithIssues: result.groups.length };
}
