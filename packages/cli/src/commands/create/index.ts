import { handleError, konsola, requireAuthentication } from '../../utils';
import { colorPalette, commands } from '../../constants';
import { getProgram } from '../../program';
import type { CreateOptions } from './constants';
import { blueprints } from './constants';
import { session } from '../../session';
import { input, select } from '@inquirer/prompts';
import { generateProject } from './actions';
import path from 'node:path';
import chalk from 'chalk';

const program = getProgram(); // Get the shared singleton instance

// Create root command
export const createCommand = program
  .command(`${commands.CREATE} [project-path]`)
  .alias('c')
  .description(`Scaffold a new project using Storyblok`)
  .option('-b, --blueprint <blueprint>', 'technology starter blueprint')
  .action(async (projectPath: string, options: CreateOptions) => {
    konsola.title(` ${commands.CREATE} `, colorPalette.CREATE);
    // Global options
    const verbose = program.opts().verbose;
    // Command options
    const { blueprint } = options;

    const { state, initializeSession } = session();
    await initializeSession();

    if (!requireAuthentication(state, verbose)) {
      return;
    }

    try {
      // Validate blueprint if provided via flag
      let technologyBlueprint = blueprint;
      if (blueprint) {
        const validBlueprints = Object.values(blueprints);
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
          choices: Object.values(blueprints).map(blueprint => ({
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
              return 'Project name (last folder) can only contain letters, numbers, hyphens, and underscores';
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

      // Show next steps
      konsola.br();
      konsola.ok(`Your ${chalk.hex(colorPalette.PRIMARY)(technologyBlueprint)} project is ready 🎉 !`);
      konsola.br();
      konsola.info(`Next steps:
  cd ${finalProjectPath}
  npm install
  npm run dev

📖 Don't forget to:
  1. Add your Storyblok access token to .env
  2. Configure the Visual Editor URL in Storyblok
  3. Start building amazing content experiences!`);
    }
    catch (error) {
      konsola.br();
      handleError(error as Error, verbose);
    }
    konsola.br();
  });
