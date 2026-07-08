import { expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import * as nodeFs from 'node:fs';
import { FileTransport } from './logger-transport-file';
import { APIError } from '../../utils/error';
import { FetchError } from '../../utils/fetch';

it('should only log level equal or more severe to the specified level', () => {
  // Error
  const transportLevelError = new FileTransport({ level: 'error' });
  transportLevelError.log({ level: 'error', message: 'Error!' });
  transportLevelError.log({ level: 'warn', message: 'Warn!' });
  transportLevelError.log({ level: 'info', message: 'Info' });
  transportLevelError.log({ level: 'debug', message: 'Debug' });
  expect(Object.values(vol.toJSON())[0]?.trim()).toMatch(/^\{"timestamp":"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z","level":"ERROR","message":"Error!"\}$/);

  // Info
  vol.reset();
  const transportLevelInfo = new FileTransport({ level: 'info' });
  transportLevelInfo.log({ level: 'error', message: 'Error!' });
  transportLevelInfo.log({ level: 'warn', message: 'Warn!' });
  transportLevelInfo.log({ level: 'info', message: 'Info' });
  transportLevelInfo.log({ level: 'debug', message: 'Debug' });
  expect(Object.values(vol.toJSON())[0]?.trim()).toMatch(/^\{"timestamp":"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z","level":"ERROR","message":"Error!"\}\n\{"timestamp":"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z","level":"WARN","message":"Warn!"\}\n\{"timestamp":"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z","level":"INFO","message":"Info"\}$/);
});

it('should format errors correctly', () => {
  const transport = new FileTransport();
  const apiError = new APIError('network_error', 'get_user', new FetchError('foo error', {
    status: 418,
    statusText: 'foo',
  }));
  transport.log({ level: 'error', message: 'Error!', context: { apiError } });
  expect(JSON.parse(Object.values(vol.toJSON())[0]?.trim() as string).context.apiError).toMatchObject({ name: 'API Error', message: 'No response from server, please check if you are correctly connected to internet', httpCode: 418, httpStatusText: 'foo', stack: expect.any(String) },
  );
});

it('should only keep n number of log files', () => {
  const maxFiles = 3;

  new FileTransport({ filePath: '1.jsonl', maxFiles }).log({ level: 'info', message: 'Log 1' });
  new FileTransport({ filePath: '2.jsonl', maxFiles }).log({ level: 'info', message: 'Log 2' });
  new FileTransport({ filePath: '3.jsonl', maxFiles }).log({ level: 'info', message: 'Log 3' });
  new FileTransport({ filePath: '4.jsonl', maxFiles }).log({ level: 'info', message: 'Log 4' });
  new FileTransport({ filePath: '5.jsonl', maxFiles }).log({ level: 'info', message: 'Log 5' });

  const files = Object.keys(vol.toJSON()).sort();
  const fileContents = Object.values(vol.toJSON());

  expect(files).toHaveLength(maxFiles);
  // Verify oldest files (Log 1 and Log 2) were deleted
  expect(fileContents.some(content => content?.includes('Log 1'))).toBe(false);
  expect(fileContents.some(content => content?.includes('Log 2'))).toBe(false);
  // Verify newest files (Log 3, 4, 5) remain
  expect(fileContents.some(content => content?.includes('Log 3'))).toBe(true);
  expect(fileContents.some(content => content?.includes('Log 4'))).toBe(true);
  expect(fileContents.some(content => content?.includes('Log 5'))).toBe(true);
});

it('should not throw when a pruned file was already removed by a concurrent process', () => {
  vol.fromJSON({ './a.jsonl': 'a', './b.jsonl': 'b', './c.jsonl': 'c' });

  // Simulate the race: between `readdirSync` and `unlinkSync` another CLI
  // process deletes the same oldest file, so the first `unlinkSync` raises
  // ENOENT. Pruning must swallow it and keep deleting the remaining files.
  const enoent = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
  const unlinkSpy = vi.spyOn(nodeFs, 'unlinkSync').mockImplementationOnce(() => {
    throw enoent;
  });

  let deleted = 0;
  expect(() => {
    deleted = FileTransport.pruneLogFiles('.', 1, '.jsonl');
  }).not.toThrow();

  // Both targeted files (a.jsonl, b.jsonl) are gone after the call; only the
  // most recent (c.jsonl) is kept.
  expect(deleted).toBe(2);
  const remaining = Object.keys(vol.toJSON()).map(p => p.split('/').pop()).sort();
  expect(remaining).not.toContain('b.jsonl');
  expect(remaining).toContain('c.jsonl');

  unlinkSpy.mockRestore();
});

it('should rethrow non-ENOENT errors while pruning', () => {
  vol.fromJSON({ './a.jsonl': 'a', './b.jsonl': 'b' });

  const eacces = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
  const unlinkSpy = vi.spyOn(nodeFs, 'unlinkSync').mockImplementationOnce(() => {
    throw eacces;
  });

  expect(() => FileTransport.pruneLogFiles('.', 1, '.jsonl')).toThrow('EACCES');

  unlinkSpy.mockRestore();
});
