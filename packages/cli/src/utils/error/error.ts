import type { LogContext } from '../../lib/logger/logger';
import { getLogger } from '../../lib/logger/logger';
import { konsola } from '..';
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

function handleVerboseError(error: unknown): void {
  if (error instanceof CommandError || error instanceof APIError || error instanceof FileSystemError) {
    const errorDetails = 'getInfo' in error ? error.getInfo() : {};
    if (error instanceof CommandError) {
      konsola.error(`Command Error: ${error.getInfo().message}`, errorDetails);
    }
    else if (error instanceof APIError) {
      konsola.error(`API Error: ${error.getInfo().cause}`, errorDetails);
    }
    else if (error instanceof FileSystemError) {
      konsola.error(`File System Error: ${error.getInfo().cause}`, errorDetails);
    }
    else {
      konsola.error(`Unexpected Error: ${error}`, errorDetails);
    }
  }
  else {
    konsola.error(`Unexpected Error`, error);
  }
}

export function handleError(error: Error | FetchError, verbose = false, context?: LogContext): void {
  // Print the message stack if it exists
  if (error instanceof APIError || error instanceof FileSystemError) {
    const messageStack = (error).messageStack;
    messageStack.forEach((message: string, index: number) => {
      konsola.error(message, null, {
        header: index === 0,
        margin: false,
      });
    });
  }
  else {
    konsola.error(error.message, null, {
      header: true,
    });
  }
  if (verbose) {
    handleVerboseError(error);
  }
  else {
    konsola.br();
    konsola.info('For more information about the error, run the command with the `--verbose` flag');
  }

  if (!process.env.VITEST) {
    console.log(''); // Add a line break for readability
  }
  getLogger().error(error.message, { error, errorCode: 'code' in error ? String(error.code) : 'UNKNOWN_ERROR', context });
}
