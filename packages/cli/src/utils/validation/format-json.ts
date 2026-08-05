import type { LevelOption, ValidationFilter, ValidationRunResult } from './types';
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
  /** The filter that narrowed the population. Omitted when none was applied. */
  filter?: ValidationFilter;
  /**
   * `true` when a filter was applied and matched nothing, so the run validated
   * no content at all. Omitted otherwise — a consumer reading `ok: true` without
   * it is looking at a run that had something to check.
   */
  noMatches?: boolean;
  errors: number;
  warnings: number;
  fetchFailures: number;
  /** Why each unit could not be fetched. Omitted when nothing failed. */
  fetchErrors?: ValidationRunResult['fetchErrors'];
  listFailed: boolean;
  /** Why listing failed. Omitted unless `listFailed` is `true`. */
  listError?: string;
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
    ...(result.filter ? { filter: result.filter } : {}),
    // Only stated when it is the whole story: a listing that failed already
    // explains the empty population through `listFailed`.
    ...(result.filter && result.unitsTotal === 0 && !listFailed ? { noMatches: true } : {}),
    errors,
    warnings,
    fetchFailures,
    // Only present when they carry information: an empty array or a null reason
    // is noise in a document a machine reads.
    ...(result.fetchErrors?.length ? { fetchErrors: result.fetchErrors } : {}),
    listFailed,
    ...(listFailed && result.listError ? { listError: result.listError } : {}),
    groups: result.groups
      .map(group => ({ ...group, issues: filterIssuesByLevel(group.issues, level) }))
      .filter(group => group.issues.length > 0),
  };

  return JSON.stringify(report, null, 2);
}
