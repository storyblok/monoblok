import { beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import { join } from 'pathe';
// Import the main module first to ensure proper initialization
import '../index';
import { logsCommand } from '../command';
import { resolveCommandPath } from '../../../utils/filesystem';
import { resetLogger } from '../../../lib/logger/logger';

vi.mock('node:fs');
vi.mock('node:fs/promises');

vi.spyOn(console, 'info');
vi.spyOn(console, 'log');

const LOGS_FILE_DIR = resolveCommandPath('logs', '12345');

const preconditions = {
  hasLogFiles() {
    vol.fromJSON({
      [join(LOGS_FILE_DIR, 'storyblok-migrations-run-1234567890.jsonl')]: 'foo',
      [join(LOGS_FILE_DIR, 'storyblok-migrations-run-1234567891.jsonl')]: 'foo',
      [join(LOGS_FILE_DIR, 'storyblok-components-push-1234567892.jsonl')]: 'foo',
    });
  },
  hasNoLogFiles() {
    vol.reset();
  },
  hasEmptyLogDirectory() {
    vol.fromJSON({
      'logs/12345/.gitkeep': '',
    });
  },
};

describe('logs list command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    // Reset logger to prevent test log files from being created
    resetLogger();
  });

  it('should list available log files', async () => {
    preconditions.hasLogFiles();

    await logsCommand.parseAsync(['node', 'test', 'list', '--space', '12345']);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Found 3 log files for space "12345":'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('storyblok-components-push-1234567892.jsonl'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('storyblok-migrations-run-1234567890.jsonl'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('storyblok-migrations-run-1234567891.jsonl'),
    );
  });

  it('should handle no logs found when directory does not exist', async () => {
    preconditions.hasNoLogFiles();

    await logsCommand.parseAsync(['node', 'test', 'list', '--space', '12345']);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('No logs found for space "12345"'),
    );
  });

  it('should handle no logs found when directory is empty', async () => {
    preconditions.hasEmptyLogDirectory();

    await logsCommand.parseAsync(['node', 'test', 'list', '--space', '12345']);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('No logs found for space "12345"'),
    );
  });
});
