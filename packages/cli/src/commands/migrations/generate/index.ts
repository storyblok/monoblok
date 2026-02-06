import type { Command } from 'commander';
import chalk from 'chalk';

import type { MigrationsGenerateOptions } from './constants';
import { colorPalette, commands } from '../../../constants';
import { CommandError, handleError, requireAuthentication } from '../../../utils';
import { session } from '../../../session';
import { fetchComponent } from '../../../commands/components';
import { migrationsCommand } from '../command';
import { generateMigration } from './actions';
import { getUI } from '../../../utils/ui';
import { getLogger } from '../../../lib/logger/logger';

const generateCmd = migrationsCommand
  .command('generate [componentName]')
  .description('Generate a migration file')
  .option('--su, --suffix <suffix>', 'suffix to add to the file name (e.g. {component-name}.<suffix>.js)')
  .option('-s, --space <space>', 'space ID')
  .option('-p, --path <path>', 'path for file storage');

generateCmd
  .action(async (componentName: string | undefined, options: MigrationsGenerateOptions, command: Command) => {
    const ui = getUI();
    const logger = getLogger();

    ui.title(`${commands.MIGRATIONS}`, colorPalette.MIGRATIONS, componentName ? `Generating migration for component ${componentName}...` : 'Generating migrations...');

    const { space, path, verbose } = command.optsWithGlobals();
    const { suffix } = options;

    logger.info('Migration generation started', {
      componentName,
      space,
      suffix,
    });

    if (!componentName) {
      handleError(new CommandError(`Please provide the component name as argument ${chalk.hex(colorPalette.MIGRATIONS)('storyblok migrations generate YOUR_COMPONENT_NAME.')}`), verbose);
      return;
    }

    const { state } = session();

    if (!requireAuthentication(state, verbose)) {
      return;
    }
    if (!space) {
      handleError(new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`), verbose);
      return;
    }

    const spinner = ui.createSpinner(`Generating migration for component ${componentName}...`);
    try {
      const component = await fetchComponent(space, componentName);

      if (!component) {
        spinner.failed(`Failed to fetch component ${componentName}. Make sure the component exists in your space.`);
        handleError(new CommandError(`No component found with name "${componentName}"`), verbose);
        return;
      }

      await generateMigration(space, path, component, suffix);

      spinner.succeed(`Migration generated for component ${chalk.hex(colorPalette.MIGRATIONS)(componentName)} - Completed in ${spinner.elapsedTime.toFixed(2)}ms`);

      const fileName = suffix ? `${component.name}.${suffix}.js` : `${component.name}.js`;
      const migrationPath = path ? `${path}/migrations/${space}/${fileName}` : `.storyblok/migrations/${space}/${fileName}`;
      ui.ok(`You can find the migration file in ${chalk.hex(colorPalette.MIGRATIONS)(migrationPath)}`);

      logger.info('Migration generation finished', {
        componentName: component.name,
        migrationPath,
        space,
        suffix,
      });
    }
    catch (error) {
      spinner.failed(`Failed to generate migration for component ${componentName}`);
      handleError(error as Error, verbose);
    }
  });
