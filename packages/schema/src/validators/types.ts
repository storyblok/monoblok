/** Severity of a {@link ValidationIssue}. `error` fails validation; `warning` does not. */
export type ValidationSeverity = 'error' | 'warning';

/** A single problem found by a validator. */
export interface ValidationIssue {
  /** `error` fails validation; `warning` is advisory. */
  severity: ValidationSeverity;
  /** Stable machine-readable identifier, e.g. `unknown_component`, `invalid_value`. */
  code: string;
  /** Location of the problem as a path of keys/indices into the validated input. */
  path: (string | number)[];
  /** The entity the issue concerns, e.g. `schema`, `story`, `block:hero`, `datasource:colors`. */
  entity: string;
  /** Human-readable description. */
  message: string;
}

/** The non-throwing result returned by {@link validateSchema} and {@link validateStory}. */
export interface ValidationResult {
  /** `true` when there are no `error`-severity issues (warnings are allowed). */
  ok: boolean;
  issues: ValidationIssue[];
}
