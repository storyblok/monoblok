import { CommandError, handleError, isRegion, isVitest, konsola, requireAuthentication, toHumanReadable } from '../../utils';
import { colorPalette, commands, type RegionCode, regions } from '../../constants';
import { performInteractiveLogin } from '../login/helpers';
import { getProgram } from '../../program';
import type { CreateOptions } from './constants';
import { session } from '../../session';
import { confirm, input, select } from '@inquirer/prompts';
import { fetchBlueprintRepositories, generateProject, generateSpaceUrl, handleEnvFileCreation, openSpaceInBrowser } from './actions';
import path from 'node:path';
import chalk from 'chalk';
import { createSpace, type SpaceCreate } from '../spaces';
import { Spinner } from '@topcli/spinner';
import { mapiClient } from '../../api';
import type { User } from '../user/actions';
import { getUser } from '../user/actions';

// Helper to show next steps and project ready message
function showNextSteps(technologyTemplate: string, finalProjectPath: string) {
  konsola.br();
  konsola.ok(`Your ${chalk.hex(colorPalette.PRIMARY)(technologyTemplate)} project is ready 🎉 !`);
  konsola.br();
  konsola.info(`Next steps:\n  cd ${finalProjectPath}\n  npm install\n  npm run dev\n        `);
  konsola.info(`Or check the dedicated guide at: ${chalk.hex(colorPalette.PRIMARY)(`https://www.storyblok.com/docs/guides/${technologyTemplate}`)}`);
}

// Helper to handle interactive login prompt
async function promptForLogin(verbose: boolean): Promise<{ token: string; region: RegionCode } | null> {
  try {
    konsola.br();
    const shouldLogin = await confirm({
      message: 'Would you like to login now?',
      default: true,
    });

    if (!shouldLogin) {
      konsola.warn('Login cancelled. You can login later using the "storyblok login" command.');
      return null;
    }

    return await performInteractiveLogin({ verbose, showWelcomeMessage: true });
  }
  catch (error) {
    konsola.br();
    handleError(error as Error, verbose);
    return null;
  }
}

const program = getProgram(); // Get the shared singleton instance

// Create root command
export const createCommand = program
  .command(`${commands.CREATE} [project-path]`)
  .alias('c')
  .description(`Scaffold a new project using Storyblok`)
  .option('-t, --template <template>', 'technology starter template')
  .option('-b, --blueprint <blueprint>', '[DEPRECATED] use --template instead')
  .option('--skip-space', 'skip space creation')
  .option('--token <token>', 'Storyblok access token (skip space creation and use this token)')
  .option(
    '-r, --region <region>',
    `The region to apply to the generated project template (does not affect space creation).`,
  )
  .action(async (projectPath: string, options: CreateOptions) => {
    konsola.title(`${commands.CREATE}`, colorPalette.CREATE);
    // Global options
    const verbose = program.opts().verbose;
    // Command options - handle backward compatibility
    const { template, blueprint, token } = options;

    if (options.region && !isRegion(options.region)) {
      handleError(new CommandError(`The provided region: ${options.region} is not valid. Please use one of the following values: ${Object.values(regions).join(' | ')}`));
      return;
    }
    // Handle deprecated blueprint option
    let selectedTemplate = template;
    if (blueprint && !template) {
      konsola.warn(`The --blueprint flag is deprecated. Please use --template instead.`);
      selectedTemplate = blueprint;
    }
    else if (blueprint && template) {
      konsola.warn(`Both --blueprint and --template provided. Using --template and ignoring --blueprint.`);
    }

    const { state, initializeSession } = session();
    await initializeSession();

    // Declare these outside to be used throughout the function
    let password: string | undefined;
    let region: RegionCode | undefined;

    // Get region from session for fallback (even when using --token)
    if (state.region) {
      region = state.region;
    }

    // If --token or --skip-space is provided, we don't need full authentication
    // Otherwise, check if user is authenticated and offer to login if not
    if (!token && !options.skipSpace) {
      if (!requireAuthentication(state, verbose)) {
        const loginResult = await promptForLogin(verbose);
        if (!loginResult) {
          return;
        }
        // Re-initialize session after login
        await initializeSession();
      }

      // After authentication check, password and region are guaranteed to be defined
      const authenticatedState = state as { isLoggedIn: true; password: string; region: RegionCode; login?: string; envLogin?: boolean };
      password = authenticatedState.password;
      region = authenticatedState.region;

      // Validate that user-provided region matches their account region when creating a space
      // This check happens early before any project scaffolding
      if (options.region && options.region !== region) {
        handleError(new CommandError(`Cannot create space in region "${options.region}". Your account is configured for region "${region}". Space creation must use your account's region.`));
        return;
      }

      mapiClient({
        token: {
          accessToken: password,
        },
        region,
      });
    }
    else if (state.isLoggedIn && state.password) {
      // If using --token or --skip-space but user is logged in, still get their credentials for mapiClient
      password = state.password;
      if (state.region) {
        region = state.region;
      }
    }

    const spinnerBlueprints = new Spinner({
      verbose: !isVitest,
    });

    const spinnerSpace = new Spinner({
      verbose: !isVitest,
    });

    try {
      spinnerBlueprints.start('Fetching starter templates...');
      const templates = await fetchBlueprintRepositories();
      spinnerBlueprints.succeed('Starter templates fetched successfully');

      if (!templates) {
        spinnerBlueprints.failed();
        konsola.warn('No starter templates found. Please contact support@storyblok.com');
        konsola.br();
        return;
      }

      // Validate template if provided via flag
      let technologyTemplate = selectedTemplate;
      if (selectedTemplate) {
        const validTemplates = templates;
        const isValidTemplate = validTemplates.find(bp => bp.value === selectedTemplate);
        if (!isValidTemplate) {
          const validOptions = validTemplates.map(bp => bp.value).join(', ');
          konsola.warn(`Invalid template "${chalk.hex(colorPalette.CREATE)(selectedTemplate)}". Valid options are: ${chalk.hex(colorPalette.CREATE)(validOptions)}`);
          konsola.br();
          // Reset template to show interactive selection
          technologyTemplate = undefined;
        }
      }

      // Select technology template (either not provided or invalid)
      if (!technologyTemplate) {
        technologyTemplate = await select({
          message: 'Please select the technology you would like to use:',
          choices: templates.map(template => ({
            name: template.name,
            value: template.value,
          })),
        });
      }

      // Get project path and extract name
      let finalProjectPath = projectPath;
      if (!projectPath) {
        finalProjectPath = await input({
          message: 'What is the path for your project?',
          default: `./my-${technologyTemplate}-project`,
          validate: (value: string) => {
            if (!value.trim()) {
              return 'Project path is required';
            }
            // Basic validation for valid paths
            const projectName = path.basename(value);
            if (!/^[\w-]+$/.test(projectName)) {
              return 'Project name (last part of the path) can only contain letters, numbers, hyphens, and underscores';
            }
            return true;
          },
        });
      }

      // Parse the path to get directory and project name
      const resolvedPath = path.resolve(finalProjectPath);
      const targetDirectory = path.dirname(resolvedPath);
      const projectName = path.basename(resolvedPath);

      konsola.br();
      konsola.info(`Scaffolding your project using the ${chalk.hex(colorPalette.CREATE)(technologyTemplate)} template...`);

      // Generate the project from the template
      await generateProject(technologyTemplate!, projectName, targetDirectory);
      konsola.ok(`Project ${chalk.hex(colorPalette.PRIMARY)(projectName)} created successfully in ${chalk.hex(colorPalette.PRIMARY)(finalProjectPath)}`, true);

      // If token is provided, use it as the access token, skip space creation, and update env
      let createdSpace;
      let userData: User;
      let whereToCreateSpace = 'personal';
      if (token) {
        await handleEnvFileCreation(resolvedPath, token, options.region || region);
        showNextSteps(technologyTemplate!, finalProjectPath);
        return;
      }
      if (options.skipSpace) {
        // Only create .env file if region is available (useful for configuring SDK)
        if (options.region || region) {
          await handleEnvFileCreation(resolvedPath, undefined, options.region || region);
        }
        showNextSteps(technologyTemplate!, finalProjectPath);
        return;
      }
      try {
        try {
          // At this point, password and region are guaranteed to be defined because:
          // 1. We're not in the token branch (which returns early)
          // 2. Authentication was required and completed
          const user = await getUser(password!, region!);
          if (!user) {
            throw new Error('User data is undefined');
          }
          userData = user;
        }
        catch {
          konsola.error('Failed to fetch user info. Your session may have expired.');
          const loginResult = await promptForLogin(verbose);
          if (!loginResult) {
            konsola.br();
            return;
          }
          // Re-initialize session and retry fetching user
          await initializeSession();
          const { password: newPassword, region: newRegion } = session().state;
          try {
            const user = await getUser(newPassword!, newRegion!);
            if (!user) {
              throw new Error('User data is undefined');
            }
            userData = user;
          }
          catch (retryError) {
            konsola.error('Failed to fetch user info after login.', retryError);
            konsola.br();
            return;
          }
        }

        // Prepare choices for space creation
        const choices = [
          { name: 'My personal account', value: 'personal' },
        ];
        if (userData.has_org) {
          choices.push({ name: `Organization (${userData?.org?.name})`, value: 'org' });
        }
        if (userData.has_partner) {
          choices.push({ name: 'Partner Portal', value: 'partner' });
        }

        if (region === regions.EU && (userData.has_partner || userData.has_org)) {
          whereToCreateSpace = await select({
            message: `Where would you like to create this space?`,
            choices,
          });
        }
        if (region !== regions.EU && userData.has_org) {
          whereToCreateSpace = 'org';
        }
        if (region !== regions.EU && !userData.has_org) {
          konsola.warn(`Space creation in this region is limited to Enterprise accounts. If you're part of an organization, please ensure you have the required permissions. For more information about Enterprise access, contact our Sales Team.`);
          konsola.br();
          return;
        }

        spinnerSpace.start(`Creating space "${toHumanReadable(projectName)}"`);

        // Find the selected blueprint from the dynamic blueprints array
        const selectedBlueprint = templates.find(bp => bp.value === technologyTemplate);
        const blueprintDomain = selectedBlueprint?.location || 'https://localhost:3000/';
        const spaceToCreate: SpaceCreate = {
          name: toHumanReadable(projectName),
          domain: blueprintDomain,
        };
        if (whereToCreateSpace === 'org') {
          spaceToCreate.org = userData.org;
          spaceToCreate.in_org = true;
        }
        else if (whereToCreateSpace === 'partner') {
          spaceToCreate.assign_partner = true;
        }
        createdSpace = await createSpace(spaceToCreate);
        spinnerSpace.succeed(`Space "${chalk.hex(colorPalette.PRIMARY)(toHumanReadable(projectName))}" created successfully`);

        // Create .env file with the Storyblok token
        if (createdSpace?.first_token) {
          await handleEnvFileCreation(resolvedPath, createdSpace.first_token, region!);
        }

        // Open the space in the browser
        if (createdSpace?.id) {
          try {
            await openSpaceInBrowser(createdSpace.id, region!);
            konsola.info(`Opened space in your browser`);
          }
          catch (error) {
            konsola.warn(`Failed to open browser: ${(error as Error).message}`);
            const spaceUrl = generateSpaceUrl(createdSpace.id, region!);
            konsola.info(`You can manually open your space at: ${chalk.hex(colorPalette.PRIMARY)(spaceUrl)}`);
          }
        }

        // Show next steps and space info
        showNextSteps(technologyTemplate!, finalProjectPath);
        if (createdSpace?.first_token) {
          if (whereToCreateSpace === 'org') {
            konsola.ok(`Storyblok space created in organization ${chalk.hex(colorPalette.PRIMARY)(userData?.org?.name)}, preview url and .env configured automatically. You can now open your space in the browser at ${chalk.hex(colorPalette.PRIMARY)(generateSpaceUrl(createdSpace.id, region!))}`);
          }
          else if (whereToCreateSpace === 'partner') {
            konsola.ok(`Storyblok space created in partner portal, preview url and .env configured automatically. You can now open your space in the browser at ${chalk.hex(colorPalette.PRIMARY)(generateSpaceUrl(createdSpace.id, region!))}`);
          }
          else {
            konsola.ok(`Storyblok space created, preview url and .env configured automatically. You can now open your space in the browser at ${chalk.hex(colorPalette.PRIMARY)(generateSpaceUrl(createdSpace.id, region!))}`);
          }
        }
      }
      catch (error) {
        spinnerSpace.failed();
        konsola.br();
        handleError(error as Error, verbose);
        return;
      }

      // showNextSteps is already called in each relevant branch above; do not call it again here.
    }
    catch (error) {
      spinnerSpace.failed();
      spinnerBlueprints.failed();
      konsola.br();
      handleError(error as Error, verbose);
    }
    konsola.br();
  });
