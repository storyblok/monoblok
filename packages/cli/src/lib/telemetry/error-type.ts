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

/** Node.js system and undici codes, e.g. `ECONNRESET` or `UND_ERR_CONNECT_TIMEOUT`. */
const SYSTEM_ERROR_CODE_PATTERN = /^(E[A-Z]{2,20}|UND_ERR_[A-Z_]{2,40})$/;

/** A class name is code, never user data, e.g. `TimeoutError`. */
const ERROR_CLASS_NAME_PATTERN = /^[A-Z][A-Za-z0-9]{0,40}Error$/;

const MAX_CAUSE_DEPTH = 5;

function errorTypeFromStatus(status: number): string {
  return ERROR_TYPE_BY_STATUS[status] ?? (status >= 500 ? "SERVER_ERROR" : `HTTP_${status}`);
}

/**
 * `fetch` puts the code on its `TypeError`'s `cause`, and `APIError` keeps the error it wraps as
 * `error`.
 */
export function getSystemErrorCode(error: unknown): string | undefined {
  let candidate = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (typeof candidate !== "object" || candidate === null) {
      return undefined;
    }
    if (
      "code" in candidate &&
      typeof candidate.code === "string" &&
      SYSTEM_ERROR_CODE_PATTERN.test(candidate.code)
    ) {
      return candidate.code;
    }
    candidate =
      "error" in candidate ? candidate.error : "cause" in candidate ? candidate.cause : undefined;
  }
  return undefined;
}

/** E.g. `TypeError` → `TYPE_ERROR`, which separates a CLI bug from a broken user file (`SYNTAX_ERROR`). */
function getErrorClassType({ name }: Error): string | undefined {
  if (name === "Error" || !ERROR_CLASS_NAME_PATTERN.test(name)) {
    return undefined;
  }
  return name.replace(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/g, "_").toUpperCase();
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
  const systemErrorCode = getSystemErrorCode(error);
  if (systemErrorCode) {
    return systemErrorCode;
  }
  if (error instanceof APIError) {
    return error.errorId.toUpperCase();
  }
  if (!(error instanceof Error)) {
    return "UNEXPECTED_ERROR";
  }
  return getErrorClassType(error) ?? "UNEXPECTED_ERROR";
}
