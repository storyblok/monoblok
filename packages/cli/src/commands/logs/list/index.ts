import { getLogsPath } from '../../../utils/filesystem';
import { getUI } from '../../../utils/ui';
import { logsCommand } from '../command';
import { FileTransport } from '../../../utils/logger-transport-file';
import { directories } from '../../../constants';

logsCommand.command('list')
  .description('List logs')
  .action(async () => {
    const { space, path } = logsCommand.opts();
    const ui = getUI();
    const logsPath = getLogsPath(directories.log, space, path);
    const logFiles = FileTransport.listLogFiles(logsPath);

    if (logFiles.length === 0) {
      ui.info(`No logs found for space "${space}".`);
      return;
    }

    ui.info(`Found ${logFiles.length} log file${logFiles.length === 1 ? '' : 's'} for space "${space}":`);
    ui.list(logFiles);
  });
