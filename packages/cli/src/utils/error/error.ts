import chalk from 'chalk';
import type { LogContext } from '../../lib/logger/logger';
import { getLogger } from '../../lib/logger/logger';
import type { FetchError } from '../fetch';
import { APIError } from './api-error';
import { CommandError } from './command-error';
import { FileSystemError } from './filesystem-error';

// Redirect all output to stderr through global console methods so test spies still work.
const stderr = {
  log: (...args: unknown[]) => console.error(...args),
  error: (...args: unknown[]) => console.error(...args),
};

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
  if (error instanceof CommandError || error instanceof APIError || error instanceof FileSystemError) {
    const errorDetails = 'getInfo' in error ? error.getInfo() : {};
    if (error instanceof CommandError) {
      stderr.error(`${chalk.red.bold('▲ error')} Command Error: ${error.getInfo().message}`, errorDetails);
    }
    else if (error instanceof APIError) {
      stderr.error(`${chalk.red.bold('▲ error')} API Error: ${error.getInfo().cause}`, errorDetails);
    }
    else if (error instanceof FileSystemError) {
      stderr.error(`${chalk.red.bold('▲ error')} File System Error: ${error.getInfo().cause}`, errorDetails);
    }
    else {
      stderr.error(`${chalk.red.bold('▲ error')} Unexpected Error: ${error}`, errorDetails);
    }
  }
  else {
    stderr.error(`${chalk.red.bold('▲ error')} Unexpected Error`, error);
  }
}

export function handleError(error: Error | FetchError, verbose = false, context?: LogContext): void {
  // Print the message stack if it exists
  if (error instanceof APIError || error instanceof FileSystemError) {
    const messageStack = (error).messageStack;
    messageStack.forEach((message: string, index: number) => {
      if (index === 0) {
        const errorHeader = chalk.bgRed.bold.white(` Error `);
        stderr.error(errorHeader);
        stderr.log('');
      }
      stderr.error(`${chalk.red.bold('▲ error')} ${message}`);
    });
  }
  else {
    const errorHeader = chalk.bgRed.bold.white(` Error `);
    stderr.error(errorHeader);
    stderr.log('');
    stderr.error(`${chalk.red.bold('▲ error')} ${error.message}`);
  }
  if (verbose) {
    handleVerboseError(error);
  }
  else {
    stderr.log('');
    stderr.log(`${chalk.blue('ℹ')} For more information about the error, run the command with the \`--verbose\` flag`);
  }

  if (!process.env.VITEST) {
    stderr.log('');
  }
  getLogger().error(error.message, { error, errorCode: 'code' in error ? String(error.code) : 'UNKNOWN_ERROR', context });

  if (!process.exitCode || process.exitCode === 0) {
    process.exitCode = error instanceof CommandError ? 2 : 1;
  }
}

export function logOnlyError(error: Error | FetchError, context?: LogContext): void {
  getLogger().error(error.message, { error, errorCode: 'code' in error ? String(error.code) : 'UNKNOWN_ERROR', context });
}
