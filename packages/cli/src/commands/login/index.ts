import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import type { RegionCode } from '../../constants';
import { colorPalette, commands, regionNames, regions } from '../../constants';
import { getProgram } from '../../program';
import { CommandError, handleError, isRegion } from '../../utils';
import { loginWithToken } from './actions';
import { session } from '../../session';
import { performInteractiveLogin } from './helpers';
import { type CLISpinner, getUI } from '../../lib/ui';

const program = getProgram(); // Get the shared singleton instance

const allRegionsText = Object.values(regions).join(',');

export const loginCommand = program
  .command(commands.LOGIN)
  .description('Login to the Storyblok CLI')
  .option('-t, --token <token>', 'Token to login directly without questions, like for CI environments')
  .option(
    '-r, --region <region>',
    `The region you would like to work in. Please keep in mind that the region must match the region of your space. This region flag will be used for the other cli's commands. You can use the values: ${allRegionsText}.`,
  )
  .action(async (options: {
    token: string;
    region: RegionCode;
  }) => {
    const ui = getUI();
    ui.title(`${commands.LOGIN}`, colorPalette.LOGIN);
    // Global options
    const verbose = program.opts().verbose;
    // Command options
    const { token, region } = options;

    const { state, updateSession, persistCredentials } = session();

    if (state.isLoggedIn && !state.envLogin) {
      ui.ok(`You are already logged in. If you want to login with a different account, please logout first.`);
      return;
    }

    if (region && !isRegion(region)) {
      handleError(new CommandError(`The provided region: ${region} is not valid. Please use one of the following values: ${Object.values(regions).join(' | ')}`));
      return;
    }

    if (token) {
      let spinner: CLISpinner | null = null;
      try {
        let userRegion = region;
        if (!userRegion) {
          userRegion = await select({
            message: 'Please select the region you would like to work in:',
            choices: Object.values(regions).map((region: RegionCode) => ({
              name: regionNames[region],
              value: region,
            })),
            default: regions.EU,
          });
        }
        spinner = ui.createSpinner(`Logging in with token`);
        const user = await loginWithToken(token, userRegion);
        if (user) {
          updateSession(user.email, token, userRegion);

          await persistCredentials(userRegion);
          spinner.succeed();

          ui.ok(`Successfully logged in to region ${chalk.hex(colorPalette.PRIMARY)(`${regionNames[userRegion]} (${userRegion})`)}. Welcome ${chalk.hex(colorPalette.PRIMARY)(user.friendly_name)}.`, true);
        }
      }
      catch (error) {
        spinner?.failed();
        ui.br();
        handleError(error as Error, verbose);
      }
    }
    else {
      try {
        const result = await performInteractiveLogin({
          verbose,
          preSelectedRegion: region,
          showWelcomeMessage: true,
        });

        if (!result) {
          ui.warn('Login cancelled or failed.');
        }
      }
      catch (error) {
        ui.br();
        handleError(error as Error, verbose);
      }
    }

    ui.br();
  });
