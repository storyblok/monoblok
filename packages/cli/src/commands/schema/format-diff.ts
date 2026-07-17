import chalk from 'chalk';

import type { DiffAction, DiffResult, EntityDiff, FieldChange } from './types';

/** Formats a field value on a single line for terminal display. */
function inlineValue(value: unknown): string {
  if (typeof value === 'string') { return value; }
  return JSON.stringify(value) ?? String(value);
}

/**
 * Renders field-level changes as colored, indented terminal lines: added fields in
 * green, removed in red, and modified as a red `before` / green `after` pair.
 * Shared by the `push` diff display and the `schema diff` command.
 */
export function renderFieldChanges(changes: FieldChange[], indent = '    '): string[] {
  const lines: string[] = [];

  for (const change of changes) {
    if (change.change === 'added') {
      lines.push(chalk.green(`${indent}+ ${change.field}: ${inlineValue(change.after)}`));
    }
    else if (change.change === 'removed') {
      lines.push(chalk.red(`${indent}- ${change.field}: ${inlineValue(change.before)}`));
    }
    else {
      lines.push(`${indent}~ ${change.field}`);
      lines.push(chalk.red(`${indent}  - ${inlineValue(change.before)}`));
      lines.push(chalk.green(`${indent}  + ${inlineValue(change.after)}`));
    }
  }

  return lines;
}

/** Per-action wording for entity tags and the summary line. */
export interface DiffLabelSet {
  create: string;
  update: string;
  unchanged: string;
  stale: string;
}

export interface FormatDiffOptions {
  /** Optional dimmed header line, e.g. `from A → to B`. */
  header?: string;
  /** Per-entity action tag wording, e.g. `(create)` or `(added)`. */
  tags: DiffLabelSet;
  /** Summary line wording, e.g. `3 to create` or `3 added`. */
  summary: DiffLabelSet;
  /** List unchanged entities in the per-entity output (default `true`). The summary count is unaffected. */
  showUnchanged?: boolean;
  /** Text shown after `Summary:` when there are no changes at all. */
  emptySummary?: string;
}

const ACTION_ICONS: Record<DiffAction, string> = {
  create: chalk.green('+'),
  update: chalk.yellow('~'),
  unchanged: chalk.dim('='),
  stale: chalk.red('-'),
};

const SECTIONS: [string, EntityDiff['type']][] = [
  ['Folders', 'folder'],
  ['Components', 'component'],
  ['Datasources', 'datasource'],
];

/**
 * Renders a {@link DiffResult} for terminal display: a `+/~/-/=` icon and action
 * tag per entity, field-level changes, and a colored summary line. Wording is
 * supplied via {@link FormatDiffOptions} so both `schema push` and `schema diff`
 * share one layout while keeping their own vocabulary.
 */
export function formatDiff(result: DiffResult, options: FormatDiffOptions): string {
  const showUnchanged = options.showUnchanged ?? true;
  const lines: string[] = [];

  if (options.header) {
    lines.push(chalk.dim(options.header));
    lines.push('');
  }

  for (const [label, type] of SECTIONS) {
    const diffs = result.diffs.filter(d => d.type === type && (showUnchanged || d.action !== 'unchanged'));
    if (diffs.length === 0) { continue; }

    lines.push(chalk.bold(label));
    for (const diff of diffs) {
      const name = diff.action === 'stale' ? chalk.red(diff.name) : diff.name;
      lines.push(`  ${ACTION_ICONS[diff.action]} ${name} ${chalk.dim(`(${options.tags[diff.action]})`)}`);
      lines.push(...renderFieldChanges(diff.changes));
    }
    lines.push('');
  }

  const summary = [
    result.creates > 0 ? chalk.green(`${result.creates} ${options.summary.create}`) : null,
    result.updates > 0 ? chalk.yellow(`${result.updates} ${options.summary.update}`) : null,
    result.stale > 0 ? chalk.red(`${result.stale} ${options.summary.stale}`) : null,
    result.unchanged > 0 ? chalk.dim(`${result.unchanged} ${options.summary.unchanged}`) : null,
  ].filter(Boolean).join(', ');

  lines.push(`Summary: ${summary || options.emptySummary || ''}`);

  return lines.join('\n');
}
