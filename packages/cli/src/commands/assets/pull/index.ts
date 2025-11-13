import { getProgram } from '../../../program';
import { colorPalette, commands } from '../../../constants';
import { mapiClient } from '../../../api';
import { handleError, konsola, requireAuthentication } from '../../../utils';

import { session } from '../../../session';
import { assetsCommand } from '../command';
import { fetchAllAssets, saveAssetsToFiles } from './actions';

const program = getProgram();

assetsCommand
  .command('pull')
  .description(`Pull assets from your space`)
  .action(async (_options) => {
    // Implement the pull action
    konsola.title(`${commands.ASSETS}`, colorPalette.ASSETS, `Pulling assets...`);

    // Global options
    const verbose = program.opts().verbose;

    // Command options
    const { space } = assetsCommand.opts();

    const { state, initializeSession } = session();
    await initializeSession();

    if (!requireAuthentication(state, verbose)) {
      return;
    }

    const { password, region } = state;

    mapiClient({
      token: {
        accessToken: password,
      },
      region,
    });

    try {
      const assets = await fetchAllAssets(space!);
      if (assets) {
        await saveAssetsToFiles(space!, assets);
      }
      else {
        konsola.warn(`No assets found in the space ${space}`);
      }
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
  });
