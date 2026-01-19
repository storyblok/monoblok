import { beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'node:path';
// Import the main module first to ensure proper initialization
import '../index';
import { reportsCommand } from '../command';
import { resolveCommandPath } from '../../../utils/filesystem';

vi.spyOn(console, 'info');
vi.spyOn(console, 'log');

const REPORTS_FILE_DIR = resolveCommandPath('reports', '12345');

const preconditions = {
  hasReportFiles() {
    vol.fromJSON({
      [path.join(REPORTS_FILE_DIR, 'storyblok-migrations-run-1234567890.jsonl')]: 'foo',
      [path.join(REPORTS_FILE_DIR, 'storyblok-migrations-run-1234567891.jsonl')]: 'foo',
      [path.join(REPORTS_FILE_DIR, 'storyblok-components-push-1234567892.jsonl')]: 'foo',
    });
  },
  hasNoReportFiles() {
    vol.reset();
  },
  hasEmptyReportDirectory() {
    vol.fromJSON({
      'reports/12345/.gitkeep': '',
    });
  },
};

describe('reports list command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  it('should list available report files', async () => {
    preconditions.hasReportFiles();

    await reportsCommand.parseAsync(['node', 'test', 'list', '--space', '12345']);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Found 3 report files for space "12345":'),
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

  it('should handle no reports found when directory does not exist', async () => {
    preconditions.hasNoReportFiles();

    await reportsCommand.parseAsync(['node', 'test', 'list', '--space', '12345']);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('No reports found for space "12345"'),
    );
  });

  it('should handle no reports found when directory is empty', async () => {
    preconditions.hasEmptyReportDirectory();

    await reportsCommand.parseAsync(['node', 'test', 'list', '--space', '12345']);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('No reports found for space "12345"'),
    );
  });
});
