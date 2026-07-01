import type { AffectedReport, ComponentImpact } from './actions';

function componentLine(component: ComponentImpact): string {
  const label = component.action === 'removed' ? 'removed' : 'changed';
  return `${component.component} (${label}): ${component.usedStories} story(s) affected, ${component.brokenStories} would break`;
}

/** Builds the human-readable summary lines (per component, per field, totals). */
export function formatSummary(report: AffectedReport): string[] {
  const lines: string[] = [];

  for (const component of report.components) {
    lines.push(componentLine(component));
    for (const field of component.fields) {
      // `used` counts stories whose content contains the field; for `required_added`
      // it is expected to be 0 (the field is absent), so phrase it as presence to
      // avoid reading as a contradiction against the break count.
      lines.push(`  - ${field.field} (${field.kind}): present in ${field.used} story(s), ${field.broken} would break`);
    }
  }

  lines.push('');
  lines.push(
    `Totals: ${report.totals.usedStories} story(s) affected across ${report.components.length} component(s); ${report.totals.brokenStories} would break.`,
  );

  return lines;
}
