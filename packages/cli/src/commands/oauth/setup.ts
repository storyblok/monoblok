import { input, password, select } from '@inquirer/prompts';
import type { RegionCode } from '../../constants';
import { colorPalette, commands, regions } from '../../constants';
import { getProgram } from '../../program';
import { CommandError, handleError, isRegion, konsola, maskToken } from '../../utils';
import { findOrCreateCliClient } from './actions';
import { updateOauthEntry } from './store';
import { oauthCommand } from './command';

const program = getProgram();

const setupCommand = oauthCommand
  .command('setup')
  .description('One-time OAuth client provisioning for your org (POC)')
  .option('-t, --token <token>', 'Personal access token of an org manager (find-or-create the "Storyblok CLI" app)')
  .option('--client-id <clientId>', 'OAuth client id shared by your org admin')
  .option('--client-secret <clientSecret>', 'OAuth client secret shared by your org admin')
  .option('-r, --region <region>', 'Region (eu, us, cn, ca, ap)', regions.EU)
  .action(async (options: { token?: string; clientId?: string; clientSecret?: string; region: RegionCode }) => {
    konsola.title(`${commands.OAUTH} setup`, colorPalette.OAUTH);
    const verbose = program.opts().verbose;

    try {
      if (!isRegion(options.region)) {
        throw new CommandError(`The provided region: ${options.region} is not valid. Please use one of: ${Object.values(regions).join(' | ')}`);
      }
      const region = options.region;

      let pat = options.token;
      let manualClientId = options.clientId;
      let manualClientSecret = options.clientSecret;

      if ((manualClientId && !manualClientSecret) || (!manualClientId && manualClientSecret)) {
        throw new CommandError('--client-id and --client-secret must be provided together.');
      }

      if (!pat && !manualClientId) {
        const path = await select({
          message: 'How do you want to provision the OAuth client?',
          choices: [
            { name: 'I manage this org — use my personal access token (creates a "Storyblok CLI" app)', value: 'pat' },
            { name: 'My org admin shared a client id + secret with me', value: 'manual' },
          ],
        });
        if (path === 'pat') {
          pat = await password({ message: 'Personal access token (used once, not stored):' });
        }
        else {
          manualClientId = await input({ message: 'OAuth client id:' });
          manualClientSecret = await password({ message: 'OAuth client secret:' });
        }
      }

      if (pat) {
        const client = await findOrCreateCliClient(pat, region);
        await updateOauthEntry(region, { client });
        konsola.ok(`OAuth client ${maskToken(client.client_id)} stored for region ${region}. The token was not persisted.`, true);
        return;
      }

      if (!manualClientId?.trim() || !manualClientSecret?.trim()) {
        throw new CommandError('Client id and client secret must not be empty.');
      }
      await updateOauthEntry(region, {
        client: { client_id: manualClientId.trim(), client_secret: manualClientSecret.trim() },
      });
      konsola.ok(`OAuth client ${maskToken(manualClientId.trim())} stored for region ${region}.`, true);
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
  });

export { setupCommand };
