import type { LogContext } from '../../lib/logger/logger';
import { getLogger } from '../../lib/logger/logger';
import { getUI } from '../../lib/ui';
import type { FetchError } from '../fetch';
import { APIError } from './api-error';
import { CommandError } from './command-error';
import { FileSystemError } from './filesystem-error';

interface ErrorWithMessage {
  message: string;
}

function hasMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object'
    && error !== null
    && 'message' in error
    && typeof (error as Record<string, unknown>).message === 'string'
  );
}

export function toError(maybeError: unknown) {
  if (maybeError instanceof Error) { return maybeError; }
  if (typeof maybeError === 'string') { return new Error(maybeError); }
  if (hasMessage(maybeError)) { return new Error(maybeError.message); }

  try {
    return new Error(JSON.stringify(maybeError));
  }
  catch {
    // fallback in case there's an error stringifying the maybeError
    // like with circular references for example.
    return new Error(String(maybeError));
  }
}

export function getResponseStatus(maybeError: unknown): number | undefined {
  const error = toError(maybeError);
  if (!('response' in error)) {
    return undefined;
  }
  const { response } = error;
  if (!response || typeof response !== 'object' || !('status' in response)) {
    return undefined;
  }
  return typeof response.status === 'number' ? response.status : undefined;
}

function handleVerboseError(error: unknown): void {
  const ui = getUI();
  if (error instanceof CommandError || error instanceof APIError || error instanceof FileSystemError) {
    const errorDetails = 'getInfo' in error ? error.getInfo() : {};
    if (error instanceof CommandError) {
      ui.error(`Command Error: ${error.getInfo().message}`, errorDetails);
    }
    else if (error instanceof APIError) {
      ui.error(`API Error: ${error.getInfo().cause}`, errorDetails);
    }
    else if (error instanceof FileSystemError) {
      ui.error(`File System Error: ${error.getInfo().cause}`, errorDetails);
    }
    else {
      ui.error(`Unexpected Error: ${error}`, errorDetails);
    }
  }
  else {
    ui.error('Unexpected Error', error);
  }
}

/**
 * Detect user-initiated prompt cancellation (Ctrl+C or Escape in @inquirer/prompts).
 * These are not application errors — exit cleanly with code 0.
 */
function isPromptCancellation(error: Error): boolean {
  return error.name === 'ExitPromptError'
    || error.name === 'AbortPromptError'
    || error.name === 'CancelPromptError';
}

export function handleError(error: Error | FetchError, verbose = false, context?: LogContext): void {
  // Prompt cancellations (Ctrl+C, Escape) are not errors — exit silently with code 0
  if (isPromptCancellation(error as Error)) {
    process.exitCode = 0;
    return;
  }

  const ui = getUI();

  // Print the message stack if it exists
  if (error instanceof APIError || error instanceof FileSystemError) {
    const messageStack = (error).messageStack;
    messageStack.forEach((message: string, index: number) => {
      if (index === 0) {
        ui.error(message, undefined, { header: true });
      }
      else {
        ui.error(message);
      }
    });
  }
  else {
    ui.error(error.message, undefined, { header: true });
  }
  if (verbose) {
    handleVerboseError(error);
  }
  else {
    ui.br();
    ui.info('For more information about the error, run the command with the `--verbose` flag');
  }

  ui.br();
  getLogger().error(error.message, { error, errorCode: 'code' in error ? String(error.code) : 'UNKNOWN_ERROR', context });

  if (!process.exitCode) {
    process.exitCode = error instanceof CommandError ? 2 : 1;
  }
}

export function logOnlyError(error: Error | FetchError, context?: LogContext): void {
  getLogger().error(error.message, { error, errorCode: 'code' in error ? String(error.code) : 'UNKNOWN_ERROR', context });
}

/**
 * Extracts a human-readable message from an error for display in per-item
 * stream failure warnings (e.g. `ui.warn`).
 *
 * For `APIError` instances, `error.message` already reflects the server-provided
 * string (set by the `APIError` constructor from `response.data.error` /
 * `response.data.message`). For all other errors it falls back to `error.message`
 * or `String(error)`.
 */
export function getApiResponseMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
