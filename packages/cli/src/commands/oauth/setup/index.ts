import { input, password, select } from '@inquirer/prompts';
import type { RegionCode } from '../../../constants';
import { colorPalette, regionNames, regions } from '../../../constants';
import { getProgram } from '../../../program';
import { CommandError, handleError, isRegion } from '../../../utils';
import { getUI } from '../../../utils/ui';
import { oauthCommand } from '../command';
import { findOrCreateCliClient } from '../actions';
import { updateOauthEntry } from '../store';

export const oauthSetupCommand = oauthCommand
  .command('setup')
  .description('Provision or store OAuth client credentials for the CLI')
  .option('-t, --token <token>', 'Personal Access Token used once to find-or-create the "Storyblok CLI" OAuth app (never stored)')
  .option('--client-id <id>', 'Provide an existing OAuth client id directly (manual path)')
  .option('--client-secret <secret>', 'Provide an existing OAuth client secret directly (manual path)')
  .option('-r, --region <region>', 'Region to store the client credentials for', regions.EU)
  .action(async (options: { token?: string; clientId?: string; clientSecret?: string; region: RegionCode }) => {
    const ui = getUI();
    const verbose = getProgram().opts().verbose;
    ui.title('oauth setup', colorPalette.OAUTH ?? colorPalette.PRIMARY);

    const region = options.region;
    if (!isRegion(region)) {
      handleError(new CommandError(`The provided region "${region}" is not valid.`), verbose);
      return;
    }

    try {
      // Manual path: explicit client id/secret (or interactive when only one is supplied).
      if (options.clientId || options.clientSecret) {
        const clientId = options.clientId ?? await input({ message: 'OAuth client id:', required: true });
        const clientSecret = options.clientSecret ?? await password({ message: 'OAuth client secret:' });
        await updateOauthEntry(region, { client: { client_id: clientId, client_secret: clientSecret } });
        ui.ok(`Stored OAuth client credentials for region ${regionNames[region]} (${region}).`, true);
        ui.br();
        return;
      }

      // PAT path: find-or-create the app.
      const strategy = options.token
        ? 'pat'
        : await select({
          message: 'How would you like to configure the OAuth client?',
          choices: [
            { name: 'Provision automatically with a Personal Access Token (org managers)', value: 'pat' },
            { name: 'Enter an existing client id and secret', value: 'manual' },
          ],
        });

      if (strategy === 'manual') {
        const clientId = await input({ message: 'OAuth client id:', required: true });
        const clientSecret = await password({ message: 'OAuth client secret:' });
        await updateOauthEntry(region, { client: { client_id: clientId, client_secret: clientSecret } });
        ui.ok(`Stored OAuth client credentials for region ${regionNames[region]} (${region}).`, true);
        ui.br();
        return;
      }

      const token = options.token ?? await password({ message: 'Personal Access Token (used once, never stored):' });
      const spinner = ui.createSpinner('Provisioning the Storyblok CLI OAuth app');
      const client = await findOrCreateCliClient(token, region);
      await updateOauthEntry(region, { client });
      spinner.succeed('OAuth client ready.');
      ui.ok(`Stored OAuth client credentials for region ${regionNames[region]} (${region}). You can now run \`storyblok login --oauth\`.`, true);
      ui.br();
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
  });
