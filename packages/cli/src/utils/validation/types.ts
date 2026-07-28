import { CommandError } from '../error';
import type { ValidationIssue } from './adapter';

/** Display filter (threshold). Never affects exit codes or summary totals. */
export type LevelOption = 'error' | 'warning';

export const LEVEL_OPTIONS = ['error', 'warning'] as const satisfies readonly LevelOption[];

/** Output format. `json` emits a single machine-readable object on stdout. */
export type FormatOption = 'pretty' | 'json';

export const FORMAT_OPTIONS = ['pretty', 'json'] as const satisfies readonly FormatOption[];

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
 *
 * `fetchFailures` and `listFailed` carry run-level (non-validation) failures so a
 * machine consumer never reads a clean result over an incomplete run.
 */
export interface ValidationRunResult {
  /** Plural noun for the summary line, e.g. `entities` or `stories`. */
  unitNoun: string;
  unitsTotal: number;
  groups: ValidationGroup[];
  /** Units that could not be fetched and were therefore not validated. */
  fetchFailures?: number;
  /** Whether listing the population failed, making the run incomplete. */
  listFailed?: boolean;
}

/**
 * Parses the `--level` value. Throws a {@link CommandError} so an invalid value
 * exits 2 like the commands' other bad-invocation paths (missing `--space`,
 * missing `--schema`) rather than commander's default 1.
 */
export function parseLevel(value: string): LevelOption {
  if (!LEVEL_OPTIONS.includes(value as LevelOption)) {
    throw new CommandError(`Invalid --level "${value}". Expected one of: ${LEVEL_OPTIONS.join(', ')}.`);
  }
  return value as LevelOption;
}

/** Parses the `--format` value. Throws a {@link CommandError} — see {@link parseLevel}. */
export function parseFormat(value: string): FormatOption {
  if (!FORMAT_OPTIONS.includes(value as FormatOption)) {
    throw new CommandError(`Invalid --format "${value}". Expected one of: ${FORMAT_OPTIONS.join(', ')}.`);
  }
  return value as FormatOption;
}
