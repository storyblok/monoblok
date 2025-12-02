import { handleError, isVitest, konsola, requireAuthentication, toHumanReadable } from '../../utils';
import { colorPalette, commands, regions } from '../../constants';
import { getProgram } from '../../program';
import type { CreateOptions } from './constants';
import { session } from '../../session';
import { input, select } from '@inquirer/prompts';
import { createEnvFile, fetchBlueprintRepositories, generateProject, generateSpaceUrl, openSpaceInBrowser } from './actions';
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

// Helper to create .env file and handle errors
async function handleEnvFileCreation(resolvedPath: string, token: string) {
  try {
    await createEnvFile(resolvedPath, token);
    konsola.ok(`Created .env file with Storyblok access token`, true);
    return true;
  }
  catch (error) {
    konsola.warn(`Failed to create .env file: ${(error as Error).message}`);
    konsola.info(`You can manually add this token to your .env file: ${token}`);
    return false;
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
  .option('--skip-space', 'skip space creation', false)
  .option('--token <token>', 'Storyblok access token (skip space creation and use this token)')
  .action(async (projectPath: string, options: CreateOptions) => {
    konsola.title(`${commands.CREATE}`, colorPalette.CREATE);
    // Global options
    const verbose = program.opts().verbose;
    // Command options - handle backward compatibility
    const { template, blueprint, token } = options;

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
        await handleEnvFileCreation(resolvedPath, token);
        showNextSteps(technologyTemplate!, finalProjectPath);
        return;
      }
      if (options.skipSpace) {
        showNextSteps(technologyTemplate!, finalProjectPath);
        return;
      }
      try {
        try {
          const user = await getUser(password, region);
          if (!user) {
            throw new Error('User data is undefined');
          }
          userData = user;
        }
        catch (error) {
          konsola.error('Failed to fetch user info. Please login again.', error);
          konsola.br();
          return;
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
          await handleEnvFileCreation(resolvedPath, createdSpace.first_token);
        }

        // Open the space in the browser
        if (createdSpace?.id) {
          try {
            await openSpaceInBrowser(createdSpace.id, region);
            konsola.info(`Opened space in your browser`);
          }
          catch (error) {
            konsola.warn(`Failed to open browser: ${(error as Error).message}`);
            const spaceUrl = generateSpaceUrl(createdSpace.id, region);
            konsola.info(`You can manually open your space at: ${chalk.hex(colorPalette.PRIMARY)(spaceUrl)}`);
          }
        }

        // Show next steps and space info
        showNextSteps(technologyTemplate!, finalProjectPath);
        if (createdSpace?.first_token) {
          if (whereToCreateSpace === 'org') {
            konsola.ok(`Storyblok space created in organization ${chalk.hex(colorPalette.PRIMARY)(userData?.org?.name)}, preview url and .env configured automatically. You can now open your space in the browser at ${chalk.hex(colorPalette.PRIMARY)(generateSpaceUrl(createdSpace.id, region))}`);
          }
          else if (whereToCreateSpace === 'partner') {
            konsola.ok(`Storyblok space created in partner portal, preview url and .env configured automatically. You can now open your space in the browser at ${chalk.hex(colorPalette.PRIMARY)(generateSpaceUrl(createdSpace.id, region))}`);
          }
          else {
            konsola.ok(`Storyblok space created, preview url and .env configured automatically. You can now open your space in the browser at ${chalk.hex(colorPalette.PRIMARY)(generateSpaceUrl(createdSpace.id, region))}`);
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
