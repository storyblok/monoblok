import { CommandError } from '../error';
import type { ValidationIssue } from './adapter';

/** Display filter (threshold). Never affects exit codes or summary totals. */
export type LevelOption = 'error' | 'warning';

export const LEVEL_OPTIONS = ['error', 'warning'] as const satisfies readonly LevelOption[];

/** Output format. `json` emits a single machine-readable object on stdout. */
export type FormatOption = 'pretty' | 'json';

export const FORMAT_OPTIONS = ['pretty', 'json'] as const satisfies readonly FormatOption[];

/**
 * Machine-readable identity of a {@link ValidationGroup}. `header` is a rendered
 * string; this is what a consumer keys on to link an issue back to the story or
 * schema entity it came from, without parsing the heading.
 */
export interface ValidationGroupRef {
  /** What the group stands for. */
  kind: 'story' | 'block' | 'datasource' | 'schema';
  /** Story ID (`kind: 'story'`). */
  id?: number;
  /** Story `full_slug` (`kind: 'story'`). */
  slug?: string;
  /** Story name, block name, or datasource slug. */
  name?: string;
}

/**
 * A group of issues under one heading — a schema entity (`hero (block)`) or a
 * story (`app/home (story #123456)`). Only groups with issues are included.
 * `header` renders for humans, `ref` carries the same identity for machines.
 */
export interface ValidationGroup {
  header: string;
  ref: ValidationGroupRef;
  issues: ValidationIssue[];
}

/**
 * The outcome of a validation run, ready to format. `unitsTotal` is the full
 * population (all entities / all stories); the summary reports groups-with-issues
 * of that total.
 *
 * `fetchFailures` and `listFailed` carry run-level (non-validation) failures so a
 * machine consumer never reads a clean result over an incomplete run. Their
 * causes travel alongside them: a `--format json` consumer sees no stderr, so
 * without these the reason for an incomplete run would be lost.
 */
export interface ValidationRunResult {
  /** Plural noun for the summary line, e.g. `entities` or `stories`. */
  unitNoun: string;
  unitsTotal: number;
  groups: ValidationGroup[];
  /** Units that could not be fetched and were therefore not validated. */
  fetchFailures?: number;
  /** Why each unit could not be fetched, in the order the failures happened. */
  fetchErrors?: { id?: number; slug?: string; message: string }[];
  /** Whether listing the population failed, making the run incomplete. */
  listFailed?: boolean;
  /** Why listing the population failed. */
  listError?: string;
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
