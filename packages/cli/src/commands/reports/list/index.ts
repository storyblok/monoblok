import type { Command } from 'commander';
import { directories } from '../../../constants';
import { resolveCommandPath } from '../../../utils/filesystem';
import { Reporter } from '../../../lib/reporter/reporter';
import { getUI } from '../../../utils/ui';
import { reportsCommand } from '../command';

const listCmd = reportsCommand.command('list')
  .description('List reports')
  .option('-s, --space <space>', 'space ID')
  .option('-p, --path <path>', 'path for file storage');

listCmd
  .action(async (_options: unknown, command: Command) => {
    const { space, path } = command.optsWithGlobals();
    const ui = getUI();
    const reportsPath = resolveCommandPath(directories.reports, space, path);
    const reportFiles = Reporter.listReportFiles(reportsPath, '.jsonl');

    if (reportFiles.length === 0) {
      ui.info(`No reports found for space "${space}".`);
      return;
    }

    ui.info(`Found ${reportFiles.length} report file${reportFiles.length === 1 ? '' : 's'} for space "${space}":`);
    ui.list(reportFiles);
  });
