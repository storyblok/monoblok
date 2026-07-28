import chalk from 'chalk';
import { colorPalette, commands } from '../../constants';
import { getProgram } from '../../program';
import { handleError } from '../../utils';
import { buildSignupUrl, openSignupInBrowser } from './actions';
import { session } from '../../session';
import { getUI } from '../../lib/ui';

const program = getProgram(); // Get the shared singleton instance

export const signupCommand = program
  .command(commands.SIGNUP)
  .description('Sign up for Storyblok')
  .action(async () => {
    const ui = getUI();
    ui.title(`${commands.SIGNUP}`, colorPalette.SIGNUP);
    // Global options
    const verbose = program.opts().verbose;
    const { state } = session();

    if (state.isLoggedIn && !state.envLogin) {
      ui.ok(`You are already logged in. If you want to signup with a different account, please logout first.`);
      return;
    }

    try {
      // Build the signup URL with UTM parameters
      const signupUrl = buildSignupUrl();

      ui.info(`Opening Storyblok signup page...`);
      ui.info(`URL: ${chalk.dim(signupUrl)}`);

      // Open the browser
      await openSignupInBrowser(signupUrl);

      ui.ok(`Browser opened! Please complete the signup process.`);
      ui.br();
      ui.info(`Once you've completed signup, run ${chalk.hex(colorPalette.PRIMARY)('storyblok login')} to authenticate with the CLI.`);
    }
    catch (error) {
      ui.br();
      handleError(error as Error, verbose);
    }

    ui.br();
  });
