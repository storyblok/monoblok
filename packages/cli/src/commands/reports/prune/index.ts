import { resolveCommandPath } from '../../../utils/filesystem';
import { Reporter } from '../../../lib/reporter/reporter';
import { getUI } from '../../../utils/ui';
import { reportsCommand } from '../command';
import { directories } from '../../../constants';

reportsCommand.command('prune')
  .description('Prune reports')
  .option('--keep <number>', 'Max number of report files to keep (default `0`, meaning remove all)', Number.parseInt, 0)
  .action(async ({ keep }: { keep: number }) => {
    const { space, path } = reportsCommand.opts();
    const ui = getUI();
    const reportsPath = resolveCommandPath(directories.report, space, path);
    const deletedFilesCount = Reporter.pruneReportFiles(reportsPath, keep, '.jsonl');

    ui.info(`Deleted ${deletedFilesCount} report file${deletedFilesCount === 1 ? '' : 's'}`);
  });
