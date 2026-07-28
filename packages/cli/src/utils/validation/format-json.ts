import type { LevelOption, ValidationRunResult } from './types';
import { countIssues, filterIssuesByLevel } from './filter';

/** The machine-readable payload emitted by `--format json`. */
export interface ValidationJsonReport {
  /**
   * `true` only for a complete run with no errors. Warnings alone keep it `true`;
   * a failed listing or any unfetched unit makes it `false` even with zero
   * issues, so a consumer never reads success over an incomplete run.
   */
  ok: boolean;
  unit: string;
  unitsTotal: number;
  unitsWithIssues: number;
  errors: number;
  warnings: number;
  fetchFailures: number;
  listFailed: boolean;
  groups: ValidationRunResult['groups'];
}

/**
 * Renders a validation run as a single JSON object. `level` filters which issues
 * appear in `groups` exactly as it does for pretty output; the counts are always
 * true totals so a consumer's thresholds are unaffected by the display filter.
 */
export function formatJson(result: ValidationRunResult, level: LevelOption): string {
  const { errors, warnings, unitsWithIssues } = countIssues(result);
  const fetchFailures = result.fetchFailures ?? 0;
  const listFailed = result.listFailed ?? false;

  const report: ValidationJsonReport = {
    ok: errors === 0 && fetchFailures === 0 && !listFailed,
    unit: result.unitNoun,
    unitsTotal: result.unitsTotal,
    unitsWithIssues,
    errors,
    warnings,
    fetchFailures,
    listFailed,
    groups: result.groups
      .map(group => ({ ...group, issues: filterIssuesByLevel(group.issues, level) }))
      .filter(group => group.issues.length > 0),
  };

  return JSON.stringify(report, null, 2);
}
