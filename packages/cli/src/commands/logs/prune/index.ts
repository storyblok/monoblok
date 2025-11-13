import { getLogsPath } from '../../../utils/filesystem';
import { getUI } from '../../../utils/ui';
import { logsCommand } from '../command';
import { FileTransport } from '../../../utils/logger-transport-file';

logsCommand.command('prune')
  .description('Prune logs')
  .option('--keep <number>', 'Max number of log files to keep (default `0`, meaning remove all)', Number.parseInt, 0)
  .action(async ({ keep }: { keep: number }) => {
    const { space, path, logFileDir } = logsCommand.opts();
    const ui = getUI();
    const logsPath = getLogsPath(logFileDir, space, path);
    const deletedFilesCount = FileTransport.pruneLogFiles(logsPath, keep);

    ui.info(`Deleted ${deletedFilesCount} log file${deletedFilesCount === 1 ? '' : 's'}`);
  });
