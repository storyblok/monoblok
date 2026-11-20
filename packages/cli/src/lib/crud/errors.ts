import { ClientError } from "@storyblok/management-api-client";
import { getLogger } from "../logger/logger";
import { getStderrTarget, getUI } from "../ui";
import { EXIT_CODE_RUNTIME_ERROR, EXIT_CODE_USAGE_ERROR } from "../../utils/error/exit-code";
import { toError } from "../../utils/error/error";
import { isRecord } from "../../utils/object";
import type { SecretScrubber } from "./redact";

// How a CRUD command reports an error: JSON on stderr when a program reads it,
// the usual human-readable error on a terminal, the same split stdout makes
// between JSONL and a table. JSON error lines are part of the pipe contract, so
// this stays apart from `utils/error` (ADR-0029). Exit codes: 2 for a usage
// error (bad flags, missing login, a missing target), 1 for everything else,
// API errors included.

export type ErrorDetails = Record<string, unknown>;

/** Per field, the values the API accepts. */
export type AllowedValues = Record<string, string[]>;

export type ErrorLine = {
  error: string;
  status?: number;
  /** The API's own error body, as it sent it. */
  details?: ErrorDetails;
  allowed_values?: AllowedValues;
  /** The line on stdin the failing record starts on, counted from 1. */
  line?: number;
  id?: number;
};

type CrudErrorOptions = {
  exitCode?: number;
  status?: number;
  details?: ErrorDetails;
  allowedValues?: AllowedValues;
  /** Every further request would fail the same way, so a batch stops. */
  stopsBatch?: boolean;
};

export class CrudError extends Error {
  readonly exitCode: number;
  readonly status?: number;
  readonly details?: ErrorDetails;
  readonly allowedValues?: AllowedValues;
  readonly stopsBatch: boolean;

  constructor(message: string, options: CrudErrorOptions = {}) {
    super(message);
    this.name = "CrudError";
    this.exitCode = options.exitCode ?? EXIT_CODE_RUNTIME_ERROR;
    this.status = options.status;
    this.details = options.details;
    this.allowedValues = options.allowedValues;
    this.stopsBatch = options.stopsBatch ?? false;
  }

  withAllowedValues(allowedValues: AllowedValues): CrudError {
    const { exitCode, status, details, stopsBatch } = this;
    return new CrudError(this.message, { exitCode, status, details, stopsBatch, allowedValues });
  }
}

/** An error the caller fixes by changing how the command is called. Exit 2. */
export function usageError(message: string, details?: ErrorDetails): CrudError {
  return new CrudError(message, { exitCode: EXIT_CODE_USAGE_ERROR, details });
}

/** The access token is rejected, or the API is out of reach: every further request would fail the same way. */
export function stopsBatch(error: CrudError): boolean {
  return error.stopsBatch || error.status === 401 || error.status === 403;
}

/** How `fetch` and the client's timeout fail when no response arrives. */
function isNetworkFailure(error: unknown): error is Error {
  return (
    (error instanceof TypeError && error.message === "fetch failed") ||
    (error instanceof Error && error.name === "TimeoutError")
  );
}

function unreachable(error: Error): CrudError {
  const cause = error.cause instanceof Error ? `: ${error.cause.message}` : "";
  return new CrudError(`Could not reach the Management API (${error.message}${cause}).`, {
    stopsBatch: true,
  });
}

/**
 * Turns anything a request threw into a {@link CrudError}. A 422 body,
 * `{ <field>: [messages] }`, becomes `details` as the API sent it.
 */
export function toCrudError(maybeError: unknown): CrudError {
  if (maybeError instanceof CrudError) {
    return maybeError;
  }
  if (isNetworkFailure(maybeError)) {
    return unreachable(maybeError);
  }
  if (maybeError instanceof ClientError) {
    const { status, statusText, data } = maybeError.response;
    if (status === 0) {
      return unreachable(maybeError);
    }
    const details = isRecord(data) ? data : undefined;
    const message =
      status === 401
        ? "The Management API rejected the access token. Run `storyblok login` again."
        : status === 403
          ? "The access token has no permission for this space or action."
          : status === 404
            ? "Not found: check the space ID and the target, and that the access token can see them."
            : status === 422
              ? "The Management API rejected the request."
              : `The Management API responded with ${status} ${statusText}.`.replace(/ \.$/, ".");
    return new CrudError(message, { status, details });
  }
  return new CrudError(toError(maybeError).message);
}

function toErrorLine(error: CrudError, context: { line?: number; id?: number }): ErrorLine {
  return {
    error: error.message,
    ...(error.status !== undefined && { status: error.status }),
    ...(error.details !== undefined && { details: error.details }),
    ...(error.allowedValues !== undefined && { allowed_values: error.allowedValues }),
    ...context,
  };
}

function printHuman(errorLine: ErrorLine): void {
  const ui = getUI();
  const where = [
    errorLine.line !== undefined && `line ${errorLine.line}`,
    errorLine.id !== undefined && `ID ${errorLine.id}`,
  ].filter(Boolean);
  ui.error(where.length > 0 ? `${errorLine.error} (${where.join(", ")})` : errorLine.error);
  // Straight to stderr: `ui.log` is off with `--no-ui-enabled`, and the details
  // are part of the error.
  for (const [field, value] of Object.entries(errorLine.details ?? {})) {
    console.error(`  ${field}: ${Array.isArray(value) ? value.join(", ") : JSON.stringify(value)}`);
  }
  for (const [field, values] of Object.entries(errorLine.allowed_values ?? {})) {
    console.error(`  ${field} accepts: ${values.join(", ")}`);
  }
}

/**
 * Reports one error on stderr and in the log, scrubbed of every secret value
 * the run has seen, and raises the exit code to the error's.
 */
export function reportError(
  maybeError: unknown,
  { scrubber, line, id }: { scrubber?: SecretScrubber; line?: number; id?: number } = {},
): void {
  const error = toCrudError(maybeError);
  const errorLine = toErrorLine(error, { line, id });
  const safe: ErrorLine = scrubber ? scrubber.scrubValue(errorLine) : errorLine;

  if (getStderrTarget() === "terminal") {
    printHuman(safe);
  } else {
    console.error(JSON.stringify(safe));
  }
  getLogger().error(safe.error, {
    status: safe.status,
    line: safe.line,
    id: safe.id,
    details: safe.details && JSON.stringify(safe.details),
    allowedValues: safe.allowed_values && JSON.stringify(safe.allowed_values),
  });

  if (Number(process.exitCode ?? 0) < error.exitCode) {
    process.exitCode = error.exitCode;
  }
}
