import type { AffectedReport, ComponentImpact } from './actions';

/** Prefixes `count` with the singular or plural noun (`1 story`, `3 stories`). */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function componentLine(component: ComponentImpact): string {
  const label = component.action === 'removed' ? 'removed' : 'changed';
  return `${component.component} (${label}): ${pluralize(component.usedStories, 'story', 'stories')} affected, ${component.brokenStories} would break`;
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
      lines.push(`  - ${field.field} (${field.kind}): present in ${pluralize(field.used, 'story', 'stories')}, ${field.broken} would break`);
    }
  }

  lines.push('');
  lines.push(
    `Totals: ${pluralize(report.totals.usedStories, 'story', 'stories')} affected across ${pluralize(report.components.length, 'component')}; ${report.totals.brokenStories} would break.`,
  );

  return lines;
}
