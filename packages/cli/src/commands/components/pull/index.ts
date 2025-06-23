import type { PullComponentsOptions } from './constants';

import { Spinner } from '@topcli/spinner';
import { colorPalette, commands } from '../../../constants';
import { CommandError, handleError, isVitest, konsola, requireAuthentication } from '../../../utils';
import { session } from '../../../session';
import { fetchComponent, fetchComponentGroups, fetchComponentInternalTags, fetchComponentPresets, fetchComponents, saveComponentsToFiles } from '../actions';
import { componentsCommand } from '../command';
import chalk from 'chalk';
import { getProgram } from '../../../program';
import { mapiClient } from '../../../api';

const program = getProgram();

componentsCommand
  .command('pull [componentName]')
  .option('-f, --filename <filename>', 'custom name to be used in file(s) name instead of space id')
  .option('--sf, --separate-files', 'Argument to create a single file for each component')
  .option('--su, --suffix <suffix>', 'suffix to add to the file name (e.g. components.<suffix>.json)')
  .description(`Download your space's components schema as json. Optionally specify a component name to pull a single component.`)
  .action(async (componentName: string | undefined, options: PullComponentsOptions) => {
    konsola.title(` ${commands.COMPONENTS} `, colorPalette.COMPONENTS, componentName ? `Pulling component ${componentName}...` : 'Pulling components...');
    // Global options
    const verbose = program.opts().verbose;

    // Command options
    const { space, path } = componentsCommand.opts();
    const { separateFiles, suffix, filename = 'components' } = options;

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

    const spinnerGroups = new Spinner({
      verbose: !isVitest,
    });
    const spinnerPresets = new Spinner({
      verbose: !isVitest,
    });
    const spinnerInternalTags = new Spinner({
      verbose: !isVitest,
    });
    const spinnerComponents = new Spinner({
      verbose: !isVitest,
    });

    try {
      // Fetch components groups
      spinnerGroups.start(`Fetching ${chalk.hex(colorPalette.COMPONENTS)('components groups')}`);

      const groups = await fetchComponentGroups(space);
      spinnerGroups.succeed(`${chalk.hex(colorPalette.COMPONENTS)('Groups')} - Completed in ${spinnerGroups.elapsedTime.toFixed(2)}ms`);

      // Fetch components presets
      spinnerPresets.start(`Fetching ${chalk.hex(colorPalette.COMPONENTS)('components presets')}`);

      const presets = await fetchComponentPresets(space);
      spinnerPresets.succeed(`${chalk.hex(colorPalette.COMPONENTS)('Presets')} - Completed in ${spinnerPresets.elapsedTime.toFixed(2)}ms`);

      // Fetch components internal tags
      spinnerInternalTags.start(`Fetching ${chalk.hex(colorPalette.COMPONENTS)('components internal tags')}`);

      const internalTags = await fetchComponentInternalTags(space);
      spinnerInternalTags.succeed(`${chalk.hex(colorPalette.COMPONENTS)('Tags')} - Completed in ${spinnerInternalTags.elapsedTime.toFixed(2)}ms`);

      // Save everything using the new structure
      let components;
      spinnerComponents.start(`Fetching ${chalk.hex(colorPalette.COMPONENTS)('components')}`);

      if (componentName) {
        const component = await fetchComponent(space, componentName);
        if (!component) {
          konsola.warn(`No component found with name "${componentName}"`);
          return;
        }
        components = [component];
      }
      else {
        components = await fetchComponents(space);
        if (!components || components.length === 0) {
          konsola.warn(`No components found in the space ${space}`);
          return;
        }
      }
      spinnerComponents.succeed(`${chalk.hex(colorPalette.COMPONENTS)('Components')} - Completed in ${spinnerComponents.elapsedTime.toFixed(2)}ms`);
      await saveComponentsToFiles(
        space,
        { components, groups: groups || [], presets: presets || [], internalTags: internalTags || [] },
        { ...options, path, separateFiles: separateFiles || !!componentName },
      );
      konsola.br();
      if (separateFiles) {
        if (filename !== 'components') {
          konsola.warn(`The --filename option is ignored when using --separate-files`);
        }
        const filePath = path ? `${path}/components/${space}/` : `.storyblok/components/${space}/`;

        konsola.ok(`Components downloaded successfully to ${chalk.hex(colorPalette.PRIMARY)(filePath)}`);
      }
      else if (componentName) {
        const fileName = suffix ? `${filename}.${suffix}.json` : `${componentName}.json`;
        const filePath = path ? `${path}/components/${space}/${fileName}` : `.storyblok/components/${space}/${fileName}`;
        konsola.ok(`Component ${chalk.hex(colorPalette.PRIMARY)(componentName)} downloaded successfully in ${chalk.hex(colorPalette.PRIMARY)(filePath)}`);
      }
      else {
        const fileName = suffix ? `${filename}.${suffix}.json` : `${filename}.json`;
        const filePath = path ? `${path}/components/${space}/${fileName}` : `.storyblok/components/${space}/${fileName}`;

        konsola.ok(`Components downloaded successfully to ${chalk.hex(colorPalette.PRIMARY)(filePath)}`);
      }
      konsola.br();
    }
    catch (error) {
      spinnerGroups.failed(`Pulling ${chalk.hex(colorPalette.COMPONENTS)('Groups')} - Failed`);
      spinnerPresets.failed(`Pulling ${chalk.hex(colorPalette.COMPONENTS)('Presets')} - Failed`);
      spinnerInternalTags.failed(`Pulling ${chalk.hex(colorPalette.COMPONENTS)('Tags')} - Failed`);
      spinnerComponents.failed(`Pulling ${chalk.hex(colorPalette.COMPONENTS)('Components')} - Failed`);
      konsola.br();
      handleError(error as Error, verbose);
    }
  });
