import { getProgram } from '../../../program';
import { colorPalette, commands } from '../../../constants';
import { mapiClient } from '../../../api';
import { handleError, konsola, requireAuthentication } from '../../../utils';

import { session } from '../../../session';
import { assetsCommand } from '../command';

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

    const client = mapiClient({
      token: {
        accessToken: password,
      },
      region,
    });

    try {
      const { data } = await client.assets.list({
        path: {
          space_id: space!,
        },
        throwOnError: true,
      });
      console.log(data);
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
  });
