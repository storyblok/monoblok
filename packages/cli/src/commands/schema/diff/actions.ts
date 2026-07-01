import chalk from 'chalk';

import type { DiffAction, DiffResult, EntityDiff, NormalizedSchema } from '../types';
import { fetchRemoteSchema, localToNormalized, remoteToNormalized } from '../actions';
import { renderFieldChanges } from '../format-diff';
import { loadSchema } from '../load-schema';

/** A schema source: a numeric space ID or a path to a schema entry file. */
export function isSpaceRef(ref: string): boolean {
  return /^\d+$/.test(ref.trim());
}

/** Resolves a source ref to a {@link NormalizedSchema}: numeric → remote space, otherwise → local entry file. */
export async function resolveSource(ref: string): Promise<NormalizedSchema> {
  if (isSpaceRef(ref)) {
    const { remote } = await fetchRemoteSchema(ref.trim());
    return remoteToNormalized(remote);
  }
  return localToNormalized(await loadSchema(ref));
}

/** Neutral, direction-aware labels: `from` (base) → `to` (target). */
const DIFF_LABELS: Record<DiffAction, string> = {
  create: 'added',
  update: 'changed',
  stale: 'removed',
  unchanged: 'unchanged',
};

const ICONS: Record<DiffAction, string> = {
  create: chalk.green('+'),
  update: chalk.yellow('~'),
  stale: chalk.red('-'),
  unchanged: chalk.dim('='),
};

/** Machine-readable diff payload emitted via the reporter's `meta.diff`. */
export interface SchemaDiffReport {
  from: string;
  to: string;
  summary: { create: number; update: number; unchanged: number; stale: number };
  entities: EntityDiff[];
}

/** Builds the serializable diff payload for the reporter. */
export function buildDiffReport(result: DiffResult, from: string, to: string): SchemaDiffReport {
  return {
    from,
    to,
    summary: { create: result.creates, update: result.updates, unchanged: result.unchanged, stale: result.stale },
    entities: result.diffs,
  };
}

/** Formats the diff for human terminal output with direction-aware wording. */
export function formatSchemaDiff(result: DiffResult, from: string, to: string): string {
  const lines: string[] = [];
  lines.push(chalk.dim(`from ${from} → to ${to}`));
  lines.push('');

  const sections: [string, EntityDiff['type']][] = [
    ['Components', 'component'],
    ['Datasources', 'datasource'],
  ];

  for (const [label, type] of sections) {
    const diffs = result.diffs.filter(d => d.type === type);
    if (diffs.length === 0) { continue; }

    lines.push(chalk.bold(label));
    for (const diff of diffs) {
      const name = diff.action === 'stale' ? chalk.red(diff.name) : diff.name;
      lines.push(`  ${ICONS[diff.action]} ${name} ${chalk.dim(`(${DIFF_LABELS[diff.action]})`)}`);
      lines.push(...renderFieldChanges(diff.changes));
    }
    lines.push('');
  }

  const summary = [
    result.creates > 0 ? chalk.green(`${result.creates} added`) : null,
    result.updates > 0 ? chalk.yellow(`${result.updates} changed`) : null,
    result.stale > 0 ? chalk.red(`${result.stale} removed`) : null,
    result.unchanged > 0 ? chalk.dim(`${result.unchanged} unchanged`) : null,
  ].filter(Boolean).join(', ');

  lines.push(`Summary: ${summary || 'no differences'}`);

  return lines.join('\n');
}
