import type { AffectedReport, ComponentImpact } from './actions';

function componentLine(component: ComponentImpact): string {
  const label = component.action === 'removed'
    ? 'removed'
    : component.action === 'target' ? 'usage' : 'changed';
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
    `Totals: ${report.totals.usedStories} story(s) affected, ${report.totals.brokenStories} would break across ${report.totals.brokenComponents} component(s).`,
  );

  return lines;
}

/** Builds the detailed affected-story list lines. */
export function formatStoryList(report: AffectedReport): string[] {
  return report.stories.map((story) => {
    const marker = story.broken ? '✖' : '⚠';
    const detail = story.issues
      .map(issue => (issue.field ? `${issue.component}.${issue.field}` : issue.component))
      .filter((value, index, all) => all.indexOf(value) === index)
      .join(', ');
    return `  ${marker} ${story.name} (${story.full_slug})${detail ? ` — ${detail}` : ''}`;
  });
}

/** Serializes the report for the `--output` JSON file. */
export function formatJson(report: AffectedReport): string {
  return JSON.stringify(report, null, 2);
}
