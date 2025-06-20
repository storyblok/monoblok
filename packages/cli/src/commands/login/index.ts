import { Spinner } from '@topcli/spinner';
import chalk from 'chalk';
import { input, password, select } from '@inquirer/prompts';
import type { RegionCode } from '../../constants';
import { colorPalette, commands, regionNames, regions } from '../../constants';
import { getProgram } from '../../program';
import { CommandError, handleError, isRegion, isVitest, konsola } from '../../utils';
import { loginWithEmailAndPassword, loginWithOtp, loginWithToken } from './actions';
import { session } from '../../session';

const program = getProgram(); // Get the shared singleton instance

const allRegionsText = Object.values(regions).join(',');
const loginStrategy = {
  message: 'How would you like to login?',
  choices: [
    {
      name: 'With email',
      value: 'login-with-email',
      short: 'Email',
    },
    {
      name: 'With Token (SSO)',
      value: 'login-with-token',
      short: 'Token',
    },
  ],
};

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
    konsola.title(` ${commands.LOGIN} `, colorPalette.LOGIN);
    // Global options
    const verbose = program.opts().verbose;
    // Command options
    const { token, region } = options;

    const { state, updateSession, persistCredentials, initializeSession } = session();

    await initializeSession();

    if (state.isLoggedIn && !state.envLogin) {
      konsola.ok(`You are already logged in. If you want to login with a different account, please logout first.`);
      return;
    }

    if (region && !isRegion(region)) {
      handleError(new CommandError(`The provided region: ${region} is not valid. Please use one of the following values: ${Object.values(regions).join(' | ')}`));
      return;
    }

    if (token) {
      const spinner = new Spinner({
        verbose: !isVitest,
      });
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
        spinner.start(`Logging in with token`);
        const { user } = await loginWithToken(token, userRegion);
        updateSession(user.email, token, userRegion);
        await persistCredentials(userRegion);
        spinner.succeed();

        konsola.ok(`Successfully logged in to region ${chalk.hex(colorPalette.PRIMARY)(`${regionNames[userRegion]} (${userRegion})`)}. Welcome ${chalk.hex(colorPalette.PRIMARY)(user.friendly_name)}.`, true);
      }
      catch (error) {
        spinner.failed();
        konsola.br();
        handleError(error as Error, verbose);
      }
    }
    else {
      const spinner = new Spinner({
        verbose: !isVitest,
      });
      try {
        const strategy = await select(loginStrategy);
        if (strategy === 'login-with-token') {
          const userToken = await password({
            message: 'Please enter your token:',
            validate: (value: string) => {
              return value.length > 0;
            },
          });
          spinner.start(`Logging in with token`);
          const { user } = await loginWithToken(userToken, region);
          spinner.succeed();
          updateSession(user.email, userToken, region);
          await persistCredentials(region);

          konsola.ok(`Successfully logged in to region ${chalk.hex(colorPalette.PRIMARY)(`${regionNames[region]} (${region})`)}. Welcome ${chalk.hex(colorPalette.PRIMARY)(user.friendly_name)}.`, true);
        }

        else {
          const userEmail = await input({
            message: 'Please enter your email address:',
            required: true,
            validate: (value: string) => {
              const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;
              return emailRegex.test(value);
            },
          });
          const userPassword = await password({
            message: 'Please enter your password:',
          });

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

          spinner.start(`Logging in with email`);
          spinner.succeed();
          const response = await loginWithEmailAndPassword(userEmail, userPassword, userRegion);

          if (response?.otp_required) {
            const otp = await input({
              message: 'Add the code from your Authenticator app, or the one we sent to your e-mail / phone:',
              required: true,
            });

            const otpResponse = await loginWithOtp(userEmail, userPassword, otp, userRegion);
            if (otpResponse?.access_token) {
              updateSession(userEmail, otpResponse?.access_token, userRegion);
            }
          }
          else if (response?.access_token) {
            updateSession(userEmail, response.access_token, userRegion);
          }
          await persistCredentials(region);

          konsola.ok(`Successfully logged in to region ${chalk.hex(colorPalette.PRIMARY)(`${regionNames[userRegion]} (${userRegion})`)}. Welcome ${chalk.hex(colorPalette.PRIMARY)(userEmail)}.`, true);
        }
      }
      catch (error) {
        spinner.failed();
        konsola.br();
        handleError(error as Error, verbose);
      }
    }

    konsola.br();
  });
