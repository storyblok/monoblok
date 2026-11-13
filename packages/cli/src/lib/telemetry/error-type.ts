import { APIError } from "../../utils/error/api-error";
import { CommandError, NotLoggedInError } from "../../utils/error/command-error";
import { FileSystemError } from "../../utils/error/filesystem-error";
import { getResponseStatus, getSystemErrorCode } from "../../utils/error/inspect";

/** A non-zero exit that neither recorded an error nor reported findings. */
export const UNRECORDED_ERROR = "UNRECORDED_ERROR";

const ERROR_TYPE_BY_STATUS: Partial<Record<number, string>> = {
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  422: "UNPROCESSABLE_ENTITY",
  429: "RATE_LIMITED",
};

const ERROR_CLASS_NAME_PATTERN = /^[A-Z][A-Za-z0-9]{0,40}Error$/;

function errorTypeFromStatus(status: number): string {
  return ERROR_TYPE_BY_STATUS[status] ?? (status >= 500 ? "SERVER_ERROR" : `HTTP_${status}`);
}

/** E.g. `TypeError` → `TYPE_ERROR`. A class name is an identifier, not content (ADR-0026). */
function getErrorClassType({ name }: Error): string | undefined {
  if (name === "Error" || !ERROR_CLASS_NAME_PATTERN.test(name)) {
    return undefined;
  }
  return name.replace(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/g, "_").toUpperCase();
}

/** Never reads the message: it can carry paths, names, and server responses. */
export function getErrorType(error: unknown): string {
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
