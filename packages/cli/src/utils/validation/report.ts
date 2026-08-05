import type { Reporter } from '../../lib/reporter/reporter';
import type { ValidationRunResult } from './types';
import { countIssues } from './filter';

/**
 * Populates the shared reporter with a validation run's summary and the full
 * issue list. The command owns enabling and finalizing the reporter; this only
 * adds data so the standard `.storyblok/reports/...` artifact carries the result.
 */
export function writeValidationReport(reporter: Reporter, result: ValidationRunResult): void {
  const { errors, warnings, unitsWithIssues } = countIssues(result);

  reporter.addSummary('validation', {
    total: result.unitsTotal,
    succeeded: result.unitsTotal - unitsWithIssues,
    failed: unitsWithIssues,
  });

  reporter.addMeta('validation', {
    unitNoun: result.unitNoun,
    errors,
    warnings,
    unitsWithIssues,
    unitsTotal: result.unitsTotal,
    groups: result.groups,
  });
}
