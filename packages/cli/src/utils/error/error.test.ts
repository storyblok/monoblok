import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getApiResponseMessage, getResponseStatus, handleError, toError } from './error';
import { CommandError } from './command-error';
import type { APIError } from './api-error';
import { handleAPIError } from './api-error';
import { FetchError } from '../fetch';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  process.exitCode = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe('handleError', () => {
  it('should output through console.error (stderr)', () => {
    handleError(new Error('boom'));
    expect(console.error).toHaveBeenCalled();
  });

  it('should set process.exitCode to 1 for a runtime Error', () => {
    handleError(new Error('runtime failure'));
    expect(process.exitCode).toBe(1);
  });

  it('should set process.exitCode to 2 for a CommandError', () => {
    handleError(new CommandError('missing --space'));
    expect(process.exitCode).toBe(2);
  });

  it('should preserve an existing non-zero exit code', () => {
    process.exitCode = 1;
    handleError(new CommandError('secondary'));
    // Should stay 1, not be overwritten to 2
    expect(process.exitCode).toBe(1);
  });

  it('should overwrite exitCode 0 with the appropriate code', () => {
    process.exitCode = 0;
    handleError(new CommandError('bad input'));
    expect(process.exitCode).toBe(2);
  });

  it('should exit cleanly (code 0) for prompt cancellations', () => {
    const exitPromptError = new Error('User force closed the prompt');
    exitPromptError.name = 'ExitPromptError';
    handleError(exitPromptError);
    expect(process.exitCode).toBe(0);
    // Should not print any error output
    expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('▲ error'));
  });

  it('should exit cleanly (code 0) for AbortPromptError', () => {
    const abortError = new Error('Prompt was aborted');
    abortError.name = 'AbortPromptError';
    handleError(abortError);
    expect(process.exitCode).toBe(0);
  });

  it('should exit cleanly (code 0) for CancelPromptError', () => {
    const cancelError = new Error('Prompt was canceled');
    cancelError.name = 'CancelPromptError';
    handleError(cancelError);
    expect(process.exitCode).toBe(0);
  });
});

describe('toError', () => {
  it('should pass through Error instances', () => {
    const err = new Error('test');
    expect(toError(err)).toBe(err);
  });

  it('should wrap a string in an Error', () => {
    const err = toError('oops');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('oops');
  });

  it('should wrap an object with a message property', () => {
    const err = toError({ message: 'from object' });
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('from object');
  });

  it('should JSON-stringify unknown values', () => {
    const err = toError({ code: 42 });
    expect(err.message).toBe('{"code":42}');
  });
});

describe('getResponseStatus', () => {
  it('should return undefined for a plain Error', () => {
    expect(getResponseStatus(new Error('no response'))).toBeUndefined();
  });

  it('should extract a numeric status from an error with a response', () => {
    const err = Object.assign(new Error('fail'), { response: { status: 403 } });
    expect(getResponseStatus(err)).toBe(403);
  });
});

describe('getApiResponseMessage', () => {
  it('should return error.message for a plain Error', () => {
    expect(getApiResponseMessage(new Error('plain error'))).toBe('plain error');
  });

  it('should return String(error) for non-Error values', () => {
    expect(getApiResponseMessage('oops')).toBe('oops');
  });

  it('should return APIError.message when response data has no string fields', () => {
    const error = new FetchError('Server Error', { status: 500, statusText: 'Internal Server Error', data: { code: 500 } });
    let caught: APIError | undefined;
    try { handleAPIError('pull_stories', error); }
    catch (e) { caught = e as APIError; }
    expect(getApiResponseMessage(caught)).toBe(caught!.message);
  });

  it('should return the server-provided message from APIError.response.data.error', () => {
    const error = new FetchError('Not Found', {
      status: 404,
      statusText: 'Not Found',
      data: { error: 'Story not found in this space' },
    });
    let caught: APIError | undefined;
    try { handleAPIError('pull_story', error); }
    catch (e) { caught = e as APIError; }
    // APIError.message is already 'Story not found in this space' after the constructor enhancement,
    // and getApiResponseMessage reads it from data.error — both paths agree.
    expect(getApiResponseMessage(caught)).toBe('Story not found in this space');
  });

  it('should fall back to error.message for non-APIError errors with no response.data', () => {
    const err = Object.assign(new Error('network failure'), { response: { status: 503 } });
    expect(getApiResponseMessage(err)).toBe('network failure');
  });
});
