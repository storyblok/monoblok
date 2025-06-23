import { Spinner } from '@topcli/spinner';
import chalk from 'chalk';

import type { MigrationsGenerateOptions } from './constants';
import { colorPalette, commands } from '../../../constants';
import { getProgram } from '../../../program';
import { CommandError, handleError, isVitest, konsola, requireAuthentication } from '../../../utils';
import { session } from '../../../session';
import { fetchComponent } from '../../../commands/components';
import { migrationsCommand } from '../command';
import { generateMigration } from './actions';
import { mapiClient } from '../../../api';

const program = getProgram();

migrationsCommand
  .command('generate [componentName]')
  .description('Generate a migration file')
  .option('--su, --suffix <suffix>', 'suffix to add to the file name (e.g. {component-name}.<suffix>.js)')
  .action(async (componentName: string | undefined, options: MigrationsGenerateOptions) => {
    konsola.title(` ${commands.MIGRATIONS} `, colorPalette.MIGRATIONS, componentName ? `Generating migration for component ${componentName}...` : 'Generating migrations...');
    // Global options
    const verbose = program.opts().verbose;

    // Command options
    const { space, path } = migrationsCommand.opts();

    const { suffix } = options;

    if (!componentName) {
      handleError(new CommandError(`Please provide the component name as argument ${chalk.hex(colorPalette.MIGRATIONS)('storyblok migrations generate YOUR_COMPONENT_NAME.')}`), verbose);
      return;
    }

    const { state, initializeSession } = session();
    await initializeSession();

    if (!requireAuthentication(state, verbose)) {
      return;
    }
    if (!space) {
      handleError(new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`), verbose);
      return;
    }

    const { password, region } = state;

    mapiClient({
      token: password,
      region,
    });

    const spinner = new Spinner({
      verbose: !isVitest,
    }).start(`Generating migration for component ${componentName}...`);
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
      konsola.ok(`You can find the migration file in ${chalk.hex(colorPalette.MIGRATIONS)(migrationPath)}`);
    }
    catch (error) {
      spinner.failed(`Failed to generate migration for component ${componentName}`);
      handleError(error as Error, verbose);
    }
  });
