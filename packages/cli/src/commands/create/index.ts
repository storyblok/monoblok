import { handleError, isVitest, konsola, requireAuthentication, toHumanReadable } from '../../utils';
import { colorPalette, commands } from '../../constants';
import { getProgram } from '../../program';
import type { CreateOptions } from './constants';
import { session } from '../../session';
import { input, select } from '@inquirer/prompts';
import { createEnvFile, fetchBlueprintRepositories, generateProject, generateSpaceUrl, openSpaceInBrowser } from './actions';
import path from 'node:path';
import chalk from 'chalk';
import { createSpace } from '../spaces';
import { Spinner } from '@topcli/spinner';
import { mapiClient } from '../../api';

const program = getProgram(); // Get the shared singleton instance

// Create root command
export const createCommand = program
  .command(`${commands.CREATE} [project-path]`)
  .alias('c')
  .description(`Scaffold a new project using Storyblok`)
  .option('-b, --blueprint <blueprint>', 'technology starter blueprint')
  .option('--skip-space', 'skip space creation')
  .action(async (projectPath: string, options: CreateOptions) => {
    konsola.title(`${commands.CREATE}`, colorPalette.CREATE);
    // Global options
    const verbose = program.opts().verbose;
    // Command options
    const { blueprint } = options;

    const { state, initializeSession } = session();
    await initializeSession();

    if (!requireAuthentication(state, verbose)) {
      return;
    }

    const { password, region } = state;

    mapiClient({
      token: password,
      region,
      onRequest: (request) => {
        console.log(request);
      },
      onResponse: (response) => {
        console.log(response);
      },
    });

    const spinnerBlueprints = new Spinner({
      verbose: !isVitest,
    });

    const spinnerSpace = new Spinner({
      verbose: !isVitest,
    });

    try {
      spinnerBlueprints.start('Fetching starter blueprints...');
      const blueprints = await fetchBlueprintRepositories();
      spinnerBlueprints.succeed('Starter blueprints fetched successfully');

      if (!blueprints) {
        spinnerBlueprints.failed();
        konsola.warn('No starter blueprints found. Please contact support@storyblok.com');
        konsola.br();
        return;
      }

      // Validate blueprint if provided via flag
      let technologyBlueprint = blueprint;
      if (blueprint) {
        const validBlueprints = blueprints;
        const isValidBlueprint = validBlueprints.find(bp => bp.value === blueprint);
        if (!isValidBlueprint) {
          const validOptions = validBlueprints.map(bp => bp.value).join(', ');
          konsola.warn(`Invalid blueprint "${chalk.hex(colorPalette.CREATE)(blueprint)}". Valid options are: ${chalk.hex(colorPalette.CREATE)(validOptions)}`);
          konsola.br();
          // Reset blueprint to show interactive selection
          technologyBlueprint = undefined;
        }
      }

      // Select technology blueprint (either not provided or invalid)
      if (!technologyBlueprint) {
        technologyBlueprint = await select({
          message: 'Please select the technology you would like to use:',
          choices: blueprints.map(blueprint => ({
            name: blueprint.name,
            value: blueprint.value,
          })),
        });
      }

      // Get project path and extract name
      let finalProjectPath = projectPath;
      if (!projectPath) {
        finalProjectPath = await input({
          message: 'What is the path for your project?',
          default: `./my-${technologyBlueprint}-project`,
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
      konsola.info(`Scaffolding your project using the ${chalk.hex(colorPalette.CREATE)(technologyBlueprint)} blueprint...`);

      // Generate the project from the template
      await generateProject(technologyBlueprint!, projectName, targetDirectory);
      konsola.ok(`Project ${chalk.hex(colorPalette.PRIMARY)(projectName)} created successfully in ${chalk.hex(colorPalette.PRIMARY)(finalProjectPath)}`, true);

      let createdSpace;
      if (!options.skipSpace) {
        try {
          spinnerSpace.start(`Creating space "${toHumanReadable(projectName)}"`);
          // Find the selected blueprint from the dynamic blueprints array
          const selectedBlueprint = blueprints.find(bp => bp.value === technologyBlueprint);
          const blueprintDomain = selectedBlueprint?.location || 'https://localhost:3000/';

          createdSpace = await createSpace({
            space: {
              name: toHumanReadable(projectName),
              domain: blueprintDomain,
            },
            in_org: false,
          });
          spinnerSpace.succeed(`Space "${chalk.hex(colorPalette.PRIMARY)(toHumanReadable(projectName))}" created successfully`);
        }
        catch (error) {
          spinnerSpace.failed();
          konsola.br();
          handleError(error as Error, verbose);
          return;
        }
      }

      // Create .env file with the Storyblok token
      if (createdSpace?.first_token) {
        try {
          await createEnvFile(resolvedPath, createdSpace.first_token);
          konsola.ok(`Created .env file with Storyblok access token`, true);
        }
        catch (error) {
          konsola.warn(`Failed to create .env file: ${(error as Error).message}`);
          konsola.info(`You can manually add this token to your .env file: ${createdSpace.first_token}`);
        }
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

      // Show next steps
      konsola.br();
      konsola.ok(`Your ${chalk.hex(colorPalette.PRIMARY)(technologyBlueprint)} project is ready 🎉 !`);
      if (createdSpace?.first_token) {
        konsola.ok(`Storyblok space created, preview url and .env configured automatically`);
      }
      konsola.br();
      konsola.info(`Next steps:
  cd ${finalProjectPath}
  npm install
  npm run dev
`);
    }
    catch (error) {
      spinnerSpace.failed();
      spinnerBlueprints.failed();
      konsola.br();
      handleError(error as Error, verbose);
    }
    konsola.br();
  });
