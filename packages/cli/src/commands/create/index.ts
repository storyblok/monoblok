import { CommandError, handleError, isRegion, isVitest, requireAuthentication, sessionCredential, toHumanReadable } from '../../utils';
import { colorPalette, commands, type RegionCode, regions } from '../../constants';
import { performInteractiveLogin } from '../login/helpers';
import { getProgram } from '../../program';
import type { CreateOptions } from './constants';
import { session } from '../../session';
import { confirm, input, select } from '@inquirer/prompts';
import { fetchBlueprintRepositories, generateProject, generateSpaceUrl, handleEnvFileCreation, openSpaceInBrowser } from './actions';
import { basename, dirname, resolve } from 'pathe';
import chalk from 'chalk';
import { createSpace, type SpaceCreate, type SpaceCreateQuery } from '../spaces';
import { Spinner } from '@topcli/spinner';
import type { User } from '../user/actions';
import { getUser } from '../user/actions';
import { getUI } from '../../utils/ui';

const ui = getUI({ enabled: true });

// Helper to show next steps and project ready message
function showNextSteps(technologyTemplate: string, finalProjectPath: string) {
  ui.br();
  ui.ok(`Your ${chalk.hex(colorPalette.PRIMARY)(technologyTemplate)} project is ready 🎉 !`);
  ui.br();
  ui.info(`Next steps:\n  cd ${finalProjectPath}\n  npm install\n  npm run dev\n        `);
  ui.info(`Or check the dedicated guide at: ${chalk.hex(colorPalette.PRIMARY)(`https://www.storyblok.com/docs/guides/${technologyTemplate}`)}`);
}

// Helper to handle interactive login prompt
async function promptForLogin(verbose: boolean): Promise<{ token: string; region: RegionCode } | null> {
  try {
    ui.br();
    const shouldLogin = await confirm({
      message: 'Would you like to login now?',
      default: true,
    });

    if (!shouldLogin) {
      ui.warn('Login cancelled. You can login later using the "storyblok login" command.');
      return null;
    }

    return await performInteractiveLogin({ verbose, showWelcomeMessage: true });
  }
  catch (error) {
    ui.br();
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
    ui.title(`${commands.CREATE}`, colorPalette.CREATE);
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
      ui.warn(`The --blueprint flag is deprecated. Please use --template instead.`);
      selectedTemplate = blueprint;
    }
    else if (blueprint && template) {
      ui.warn(`Both --blueprint and --template provided. Using --template and ignoring --blueprint.`);
    }

    const { state, initializeSession } = session();

    // Declare region outside to be used throughout the function.
    // The API credential (PAT or OAuth token) is resolved from the session via
    // sessionCredential() at each call site; the shared MAPI client is already
    // configured by the program preAction hook.
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

      // After authentication check, region is guaranteed to be defined.
      region = state.region ?? region;

      // Validate that user-provided region matches their account region when creating a space
      // This check happens early before any project scaffolding
      if (options.region && options.region !== region) {
        handleError(new CommandError(`Cannot create space in region "${options.region}". Your account is configured for region "${region}". Space creation must use your account's region.`));
        return;
      }
    }
    else if (state.isLoggedIn && state.region) {
      // If using --token or --skip-space but user is logged in, keep their region.
      region = state.region;
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

      if (templates.length === 0) {
        spinnerBlueprints.failed();
        ui.warn('No starter templates found. Please contact support@storyblok.com');
        ui.br();
        return;
      }

      // Validate template if provided via flag
      let technologyTemplate = selectedTemplate;
      if (selectedTemplate) {
        const validTemplates = templates;
        const isValidTemplate = validTemplates.find(bp => bp.value === selectedTemplate);
        if (!isValidTemplate) {
          const validOptions = validTemplates.map(bp => bp.value).join(', ');
          ui.warn(`Invalid template "${chalk.hex(colorPalette.CREATE)(selectedTemplate)}". Valid options are: ${chalk.hex(colorPalette.CREATE)(validOptions)}`);
          ui.br();
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
            const projectName = basename(value);
            if (!/^[\w-]+$/.test(projectName)) {
              return 'Project name (last part of the path) can only contain letters, numbers, hyphens, and underscores';
            }
            return true;
          },
        });
      }

      // Parse the path to get directory and project name
      const resolvedPath = resolve(finalProjectPath);
      const targetDirectory = dirname(resolvedPath);
      const projectName = basename(resolvedPath);

      ui.br();
      ui.info(`Scaffolding your project using the ${chalk.hex(colorPalette.CREATE)(technologyTemplate)} template...`);

      // Generate the project from the template
      await generateProject(technologyTemplate!, projectName, targetDirectory);
      ui.ok(`Project ${chalk.hex(colorPalette.PRIMARY)(projectName)} created successfully in ${chalk.hex(colorPalette.PRIMARY)(finalProjectPath)}`, true);

      // If token is provided, use it as the access token, skip space creation, and update env
      let createdSpace;
      let userData: User;
      let whereToCreateSpace = 'personal';
      if (token) {
        await handleEnvFileCreation(resolvedPath, token, options.region || region, technologyTemplate);
        showNextSteps(technologyTemplate!, finalProjectPath);
        return;
      }
      if (options.skipSpace) {
        // Only create .env file if region is available (useful for configuring SDK)
        if (options.region || region) {
          await handleEnvFileCreation(resolvedPath, undefined, options.region || region, technologyTemplate);
        }
        showNextSteps(technologyTemplate!, finalProjectPath);
        return;
      }
      try {
        try {
          // At this point, a credential and region are guaranteed to be defined because:
          // 1. We're not in the token branch (which returns early)
          // 2. Authentication was required and completed (PAT password or OAuth token)
          const credential = sessionCredential(state);
          if (!credential) {
            throw new Error('No credential found');
          }
          const user = await getUser(credential, region!);
          if (!user) {
            throw new Error('User data is undefined');
          }
          userData = user;
        }
        catch {
          ui.error('Failed to fetch user info. Your session may have expired.');
          const loginResult = await promptForLogin(verbose);
          if (!loginResult) {
            ui.br();
            return;
          }
          // Re-initialize session and retry fetching user
          await initializeSession();
          const retryState = session().state;
          const retryCredential = sessionCredential(retryState);
          try {
            const user = await getUser(retryCredential!, retryState.region!);
            if (!user) {
              throw new Error('User data is undefined');
            }
            userData = user;
          }
          catch (retryError) {
            ui.error('Failed to fetch user info after login.', retryError);
            ui.br();
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
          ui.warn(`Space creation in this region is limited to Enterprise accounts. If you're part of an organization, please ensure you have the required permissions. For more information about Enterprise access, contact our Sales Team.`);
          ui.br();
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
        // `in_org`/`assign_partner` are create-time query parameters, not body fields.
        const createSpaceQuery: Pick<SpaceCreateQuery, 'in_org' | 'assign_partner' | 'space_type' | 'dup_id'> = {};
        if (whereToCreateSpace === 'org') {
          createSpaceQuery.in_org = true;
        }
        else if (whereToCreateSpace === 'partner') {
          createSpaceQuery.assign_partner = true;
        }
        createdSpace = await createSpace(spaceToCreate, createSpaceQuery);
        spinnerSpace.succeed(`Space "${chalk.hex(colorPalette.PRIMARY)(toHumanReadable(projectName))}" created successfully`);

        // Create .env file with the Storyblok token
        if (createdSpace?.first_token) {
          await handleEnvFileCreation(resolvedPath, createdSpace.first_token, region!, technologyTemplate);
        }

        // Open the space in the browser
        if (createdSpace?.id) {
          try {
            await openSpaceInBrowser(createdSpace.id, region!);
            ui.info(`Opened space in your browser`);
          }
          catch (error) {
            ui.warn(`Failed to open browser: ${(error as Error).message}`);
            const spaceUrl = generateSpaceUrl(createdSpace.id, region!);
            ui.info(`You can manually open your space at: ${chalk.hex(colorPalette.PRIMARY)(spaceUrl)}`);
          }
        }

        // Show next steps and space info
        showNextSteps(technologyTemplate!, finalProjectPath);
        if (createdSpace?.first_token) {
          if (whereToCreateSpace === 'org') {
            ui.ok(`Storyblok space created in organization ${chalk.hex(colorPalette.PRIMARY)(userData?.org?.name)}, preview url and .env configured automatically. You can now open your space in the browser at ${chalk.hex(colorPalette.PRIMARY)(generateSpaceUrl(createdSpace.id, region!))}`);
          }
          else if (whereToCreateSpace === 'partner') {
            ui.ok(`Storyblok space created in partner portal, preview url and .env configured automatically. You can now open your space in the browser at ${chalk.hex(colorPalette.PRIMARY)(generateSpaceUrl(createdSpace.id, region!))}`);
          }
          else {
            ui.ok(`Storyblok space created, preview url and .env configured automatically. You can now open your space in the browser at ${chalk.hex(colorPalette.PRIMARY)(generateSpaceUrl(createdSpace.id, region!))}`);
          }
        }
      }
      catch (error) {
        spinnerSpace.failed();
        ui.br();
        handleError(error as Error, verbose);
        return;
      }

      // showNextSteps is already called in each relevant branch above; do not call it again here.
    }
    catch (error) {
      spinnerSpace.failed();
      spinnerBlueprints.failed();
      ui.br();
      handleError(error as Error, verbose);
    }
    ui.br();
  });
