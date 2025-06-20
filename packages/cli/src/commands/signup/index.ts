import chalk from 'chalk';
import { colorPalette, commands } from '../../constants';
import { getProgram } from '../../program';
import { handleError, konsola } from '../../utils';
import { buildSignupUrl, openSignupInBrowser } from './actions';
import { session } from '../../session';

const program = getProgram(); // Get the shared singleton instance

export const signupCommand = program
  .command(commands.SIGNUP)
  .description('Sign up for Storyblok')
  .action(async () => {
    konsola.title(` ${commands.SIGNUP} `, colorPalette.SIGNUP);
    // Global options
    const verbose = program.opts().verbose;

    const { state, initializeSession } = session();

    await initializeSession();

    if (state.isLoggedIn && !state.envLogin) {
      konsola.ok(`You are already logged in. If you want to signup with a different account, please logout first.`);
      return;
    }

    try {
      // Build the signup URL with UTM parameters
      const signupUrl = buildSignupUrl();

      konsola.info(`Opening Storyblok signup page...`);
      konsola.info(`URL: ${chalk.dim(signupUrl)}`);

      // Open the browser
      await openSignupInBrowser(signupUrl);

      konsola.ok(`Browser opened! Please complete the signup process.`);
      konsola.br();
      konsola.info(`Once you've completed signup, run ${chalk.hex(colorPalette.PRIMARY)('storyblok login')} to authenticate with the CLI.`);
    }
    catch (error) {
      konsola.br();
      handleError(error as Error, verbose);
    }

    konsola.br();
  });
