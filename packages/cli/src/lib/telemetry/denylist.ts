import type { Argument, Option } from "commander";

/**
 * Matched against the end of an option's or argument's name, e.g. `--asset-token`, `--out-dir`,
 * `[entry-file]`, `[migrationFile]`. Data stored in Storyblok anyway (slugs, queries, names) is
 * fine to send; secrets and anything on the user's machine are not.
 */
const SENSITIVE_NAME_PATTERN = /(token|secret|password|path|file|filename|dir)$/i;

const deniedTargets = new WeakSet<Option | Argument>();

/**
 * Makes telemetry send `[REDACTED]` instead of this option's or argument's value. Needed for
 * secrets and local paths whose name doesn't already end in one of `SENSITIVE_NAME_PATTERN`.
 */
export function denyTelemetryValue<T extends Option | Argument>(target: T): T {
  deniedTargets.add(target);
  return target;
}

export function isTelemetryValueAllowed(target: Option | Argument, name: string): boolean {
  return !deniedTargets.has(target) && !SENSITIVE_NAME_PATTERN.test(name);
}
