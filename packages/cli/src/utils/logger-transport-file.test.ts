import { beforeEach, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import { FileTransport } from './logger-transport-file';

vi.mock('node:fs');
vi.mock('node:fs/promises');

beforeEach(() => {
  vol.reset();
});

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
