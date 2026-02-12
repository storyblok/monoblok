import type { Command } from 'commander';
import { resolveCommandPath } from '../../../utils/filesystem';
import { getUI } from '../../../utils/ui';
import { logsCommand } from '../command';
import { FileTransport } from '../../../lib/logger/logger-transport-file';
import { directories } from '../../../constants';

const pruneCmd = logsCommand.command('prune')
  .description('Prune logs')
  .option('--keep <number>', 'Max number of log files to keep (default `0`, meaning remove all)', Number.parseInt, 0)
  .option('-s, --space <space>', 'space ID')
  .option('-p, --path <path>', 'path for file storage');

pruneCmd
  .action(async (options: { keep: number }, command: Command) => {
    const { space, path } = command.optsWithGlobals();
    const ui = getUI();
    const logsPath = resolveCommandPath(directories.logs, space, path);
    const deletedFilesCount = FileTransport.pruneLogFiles(logsPath, options.keep);

    ui.info(`Deleted ${deletedFilesCount} log file${deletedFilesCount === 1 ? '' : 's'}`);
  });
