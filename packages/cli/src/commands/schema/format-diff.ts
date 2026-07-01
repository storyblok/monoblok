import chalk from 'chalk';

import type { FieldChange } from './types';

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
