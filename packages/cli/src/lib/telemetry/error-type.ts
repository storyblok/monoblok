import { APIError } from "../../utils/error/api-error";
import { CommandError, NotLoggedInError } from "../../utils/error/command-error";
import { FileSystemError } from "../../utils/error/filesystem-error";
import { getResponseStatus, isPromptCancellation } from "../../utils/error/inspect";

export const CANCELED = "CANCELED";

const ERROR_TYPE_BY_STATUS: Partial<Record<number, string>> = {
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  422: "UNPROCESSABLE_ENTITY",
  429: "RATE_LIMITED",
};

/** Built-in classes separate a CLI bug (`TypeError`) from a broken user file (`SyntaxError`). */
const BUILT_IN_ERROR_TYPES: Partial<Record<string, string>> = {
  TypeError: "TYPE_ERROR",
  SyntaxError: "SYNTAX_ERROR",
  RangeError: "RANGE_ERROR",
  ReferenceError: "REFERENCE_ERROR",
  URIError: "URI_ERROR",
  EvalError: "EVAL_ERROR",
  AggregateError: "AGGREGATE_ERROR",
};

/** Node.js system and undici codes, e.g. `ECONNRESET` or `UND_ERR_CONNECT_TIMEOUT`. */
const SYSTEM_ERROR_CODE_PATTERN = /^(E[A-Z]{2,20}|UND_ERR_[A-Z_]{2,40})$/;

function errorTypeFromStatus(status: number): string {
  return ERROR_TYPE_BY_STATUS[status] ?? (status >= 500 ? "SERVER_ERROR" : `HTTP_${status}`);
}

/** `fetch` wraps network failures in a `TypeError` whose `cause` carries the code. */
function getSystemErrorCode(error: Error): string | undefined {
  for (const candidate of [error, error.cause]) {
    if (typeof candidate === "object" && candidate !== null && "code" in candidate) {
      const { code } = candidate;
      if (typeof code === "string" && SYSTEM_ERROR_CODE_PATTERN.test(code)) {
        return code;
      }
    }
  }
  return undefined;
}

/** Never reads the message: it can carry paths, names, and server responses. */
export function getErrorType(error: unknown): string {
  if (isPromptCancellation(error)) {
    return CANCELED;
  }
  if (error instanceof NotLoggedInError) {
    return "NOT_LOGGED_IN";
  }
  if (error instanceof CommandError) {
    return "USAGE_ERROR";
  }
  if (error instanceof FileSystemError) {
    return `FS_${error.errorId.toUpperCase()}`;
  }
  const status = getResponseStatus(error);
  if (status) {
    return errorTypeFromStatus(status);
  }
  if (error instanceof APIError) {
    return error.errorId.toUpperCase();
  }
  if (!(error instanceof Error)) {
    return "UNEXPECTED_ERROR";
  }
  return getSystemErrorCode(error) ?? BUILT_IN_ERROR_TYPES[error.name] ?? "UNEXPECTED_ERROR";
}
