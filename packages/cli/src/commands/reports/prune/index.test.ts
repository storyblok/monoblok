import { beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'node:path';
// Import the main first to ensure proper initialization
import '../index';
import { reportsCommand } from '../command';
import { resolveCommandPath } from '../../../utils/filesystem';
import { resetLogger } from '../../../lib/logger/logger';

vi.spyOn(console, 'info');

const REPORTS_FILE_DIR = resolveCommandPath('reports', '12345');

const preconditions = {
  hasReportFiles() {
    vol.fromJSON({
      [path.join(REPORTS_FILE_DIR, 'storyblok-migrations-run-1234567890.jsonl')]: 'foo',
      [path.join(REPORTS_FILE_DIR, 'storyblok-migrations-run-1234567891.jsonl')]: 'foo',
      [path.join(REPORTS_FILE_DIR, 'storyblok-components-push-1234567892.jsonl')]: 'foo',
    });
  },
};

describe('reports prune command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    // Reset logger to prevent test log files from being created
    resetLogger();
  });

  it('should delete all reports when keep is 0 (default)', async () => {
    preconditions.hasReportFiles();

    await reportsCommand.parseAsync(['node', 'test', 'prune', '--space', '12345']);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Deleted 3 report files'),
    );
    const remainingFiles = Object.keys(vol.toJSON())
      .filter(path => path.includes('.jsonl'));
    expect(remainingFiles).toHaveLength(0);
  });

  it('should keep specified number of recent reports', async () => {
    preconditions.hasReportFiles();

    await reportsCommand.parseAsync(['node', 'test', 'prune', '--space', '12345', '--keep', '2']);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Deleted 1 report file'),
    );
    const remainingFiles = Object.keys(vol.toJSON())
      .filter(path => path.includes('.jsonl'));
    expect(remainingFiles).toHaveLength(2);
  });

  it('should not delete reports when keep count equals total', async () => {
    preconditions.hasReportFiles();

    await reportsCommand.parseAsync(['node', 'test', 'prune', '--space', '12345', '--keep', '3']);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Deleted 0 report files'),
    );
    const remainingFiles = Object.keys(vol.toJSON())
      .filter(path => path.includes('.jsonl'));
    expect(remainingFiles).toHaveLength(3);
  });

  it('should not delete reports when keep count exceeds total', async () => {
    preconditions.hasReportFiles();

    await reportsCommand.parseAsync(['node', 'test', 'prune', '--space', '12345', '--keep', '10']);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Deleted 0 report files'),
    );
    const remainingFiles = Object.keys(vol.toJSON())
      .filter(path => path.includes('.jsonl'));
    expect(remainingFiles).toHaveLength(3);
  });
});
