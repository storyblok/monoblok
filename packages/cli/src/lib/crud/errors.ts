import { ClientError } from "@storyblok/management-api-client";
import { getLogger } from "../logger/logger";
import { getStderrTarget, getUI } from "../ui";
import { EXIT_CODE_RUNTIME_ERROR, EXIT_CODE_USAGE_ERROR } from "../../utils/error/exit-code";
import { toError } from "../../utils/error/error";
import { isRecord } from "../../utils/object";
import type { SecretScrubber } from "./redact";

// How a CRUD command reports an error: JSON on stderr when a program reads it,
// the usual human-readable error on a terminal, the same split stdout makes
// between JSONL and a table (see ADR-0029). Exit codes: 2 for a usage error (bad
// flags, missing login, a missing target), 1 for everything else, API errors
// included.

export type ErrorDetails = Record<string, unknown>;

export type ErrorLine = {
  error: string;
  status?: number;
  details?: ErrorDetails;
  /** The line on stdin the failing record starts on, counted from 1. */
  line?: number;
  id?: number;
};

export class CrudError extends Error {
  readonly exitCode: number;
  readonly status?: number;
  readonly details?: ErrorDetails;

  constructor(
    message: string,
    options: { exitCode?: number; status?: number; details?: ErrorDetails } = {},
  ) {
    super(message);
    this.name = "CrudError";
    this.exitCode = options.exitCode ?? EXIT_CODE_RUNTIME_ERROR;
    this.status = options.status;
    this.details = options.details;
  }
}

/** An error the caller fixes by changing how the command is called. Exit 2. */
export function usageError(message: string, details?: ErrorDetails): CrudError {
  return new CrudError(message, { exitCode: EXIT_CODE_USAGE_ERROR, details });
}

/** The access token is rejected: every further request would fail the same way. */
export function stopsBatch(error: CrudError): boolean {
  return error.status === 401 || error.status === 403;
}

/**
 * Turns anything a request threw into a {@link CrudError}. A 422 body,
 * `{ <field>: [messages] }`, becomes `details` as the API sent it.
 */
export function toCrudError(maybeError: unknown): CrudError {
  if (maybeError instanceof CrudError) {
    return maybeError;
  }
  if (maybeError instanceof ClientError) {
    const { status, statusText, data } = maybeError.response;
    if (status === 0) {
      return new CrudError(`Could not reach the Management API: ${maybeError.message}`);
    }
    const details = isRecord(data) ? data : undefined;
    const message =
      status === 401
        ? "The Management API rejected the access token. Run `storyblok login` again."
        : status === 403
          ? "The access token has no permission for this space or action."
          : status === 404
            ? "Not found: the space or the record doesn't exist, or the access token can't see it."
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
  });

  if (Number(process.exitCode ?? 0) < error.exitCode) {
    process.exitCode = error.exitCode;
  }
}
