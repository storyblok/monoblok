import { konsola } from '..';
import type { FetchError } from '../fetch';
import { APIError } from './api-error';
import { CommandError } from './command-error';
import { FileSystemError } from './filesystem-error';

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

export function handleError(error: Error | FetchError, verbose = false): void {
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
    // process.exit(1) // Exit process if not in a test environment
  }
}
