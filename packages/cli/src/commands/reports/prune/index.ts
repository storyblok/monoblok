import type { Command } from 'commander';
import { resolveCommandPath } from '../../../utils/filesystem';
import { Reporter } from '../../../lib/reporter/reporter';
import { getUI } from '../../../utils/ui';
import { reportsCommand } from '../command';
import { directories } from '../../../constants';

const pruneCmd = reportsCommand.command('prune')
  .description('Prune reports')
  .option('--keep <number>', 'Max number of report files to keep (default `0`, meaning remove all)', Number.parseInt, 0)
  .option('-s, --space <space>', 'space ID')
  .option('-p, --path <path>', 'path for file storage');

pruneCmd
  .action(async (options: { keep: number }, command: Command) => {
    const { space, path } = command.optsWithGlobals();
    const ui = getUI();
    const reportsPath = resolveCommandPath(directories.reports, space, path);
    const deletedFilesCount = Reporter.pruneReportFiles(reportsPath, options.keep, '.jsonl');

    ui.info(`Deleted ${deletedFilesCount} report file${deletedFilesCount === 1 ? '' : 's'}`);
  });
