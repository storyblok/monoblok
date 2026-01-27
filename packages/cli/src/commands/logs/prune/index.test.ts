import { beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'node:path';
// Import the main module first to ensure proper initialization
import '../index';
import { logsCommand } from '../command';
import { resolveCommandPath } from '../../../utils/filesystem';
import { resetLogger } from '../../../lib/logger/logger';

vi.mock('node:fs');
vi.mock('node:fs/promises');

vi.spyOn(console, 'info');

const LOGS_FILE_DIR = resolveCommandPath('logs', '12345');

const preconditions = {
  hasLogFiles() {
    vol.fromJSON({
      [path.join(LOGS_FILE_DIR, 'storyblok-migrations-run-1234567890.jsonl')]: 'foo',
      [path.join(LOGS_FILE_DIR, 'storyblok-migrations-run-1234567891.jsonl')]: 'foo',
      [path.join(LOGS_FILE_DIR, 'storyblok-components-push-1234567892.jsonl')]: 'foo',
    });
  },
};

describe('logs prune command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    // Reset logger to prevent test log files from being created
    resetLogger();
  });

  it('should delete all logs when keep is 0 (default)', async () => {
    preconditions.hasLogFiles();

    await logsCommand.parseAsync(['node', 'test', 'prune', '--space', '12345']);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Deleted 3 log files'),
    );
    const remainingFiles = Object.keys(vol.toJSON())
      .filter(path => path.includes('.jsonl'));
    expect(remainingFiles).toHaveLength(0);
  });

  it('should keep specified number of recent logs', async () => {
    preconditions.hasLogFiles();

    await logsCommand.parseAsync(['node', 'test', 'prune', '--space', '12345', '--keep', '2']);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Deleted 1 log file'),
    );
    const remainingFiles = Object.keys(vol.toJSON())
      .filter(path => path.includes('.jsonl'));
    expect(remainingFiles).toHaveLength(2);
  });

  it('should not delete logs when keep count equals total', async () => {
    preconditions.hasLogFiles();

    await logsCommand.parseAsync(['node', 'test', 'prune', '--space', '12345', '--keep', '3']);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Deleted 0 log files'),
    );
    const remainingFiles = Object.keys(vol.toJSON())
      .filter(path => path.includes('.jsonl'));
    expect(remainingFiles).toHaveLength(3);
  });

  it('should not delete logs when keep count exceeds total', async () => {
    preconditions.hasLogFiles();

    await logsCommand.parseAsync(['node', 'test', 'prune', '--space', '12345', '--keep', '10']);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Deleted 0 log files'),
    );
    const remainingFiles = Object.keys(vol.toJSON())
      .filter(path => path.includes('.jsonl'));
    expect(remainingFiles).toHaveLength(3);
  });
});
