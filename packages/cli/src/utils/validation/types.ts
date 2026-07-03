import { InvalidArgumentError } from 'commander';
import type { ValidationIssue } from './adapter';

/** Display filter (threshold). Never affects exit codes or summary totals. */
export type LevelOption = 'error' | 'warning';

export const LEVEL_OPTIONS = ['error', 'warning'] as const satisfies readonly LevelOption[];

/**
 * A group of issues under one heading — a schema entity (`hero (block)`) or a
 * story (`app/home (story #123456)`). Only groups with issues are included.
 */
export interface ValidationGroup {
  header: string;
  issues: ValidationIssue[];
}

/**
 * The outcome of a validation run, ready to format. `unitsTotal` is the full
 * population (all entities / all stories); the summary reports groups-with-issues
 * of that total.
 */
export interface ValidationRunResult {
  /** Plural noun for the summary line, e.g. `entities` or `stories`. */
  unitNoun: string;
  unitsTotal: number;
  groups: ValidationGroup[];
}

/** Commander option parser for `--level`. */
export function parseLevel(value: string): LevelOption {
  if (!LEVEL_OPTIONS.includes(value as LevelOption)) {
    throw new InvalidArgumentError(`Expected one of: ${LEVEL_OPTIONS.join(', ')}.`);
  }
  return value as LevelOption;
}
