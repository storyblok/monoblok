import type { PushComponentsOptions } from './constants';

import { colorPalette, commands } from '../../../constants';
import { getProgram } from '../../../program';
import { CommandError, handleError, konsola, requireAuthentication } from '../../../utils';
import { session } from '../../../session';
import { readComponentsFiles } from './actions';
import { componentsCommand } from '../command';
import { filterSpaceDataByComponent, filterSpaceDataByPattern } from './utils';
import { pushWithDependencyGraph } from './graph-operations';
import chalk from 'chalk';
import { mapiClient } from '../../../api';
import { fetchComponentGroups, fetchComponentInternalTags, fetchComponentPresets, fetchComponents } from '../actions';
import type { SpaceComponent, SpaceComponentGroup, SpaceComponentInternalTag, SpaceComponentPreset, SpaceDataState } from '../constants';

const program = getProgram(); // Get the shared singleton instance

componentsCommand
  .command('push [componentName]')
  .description(`Push your space's components schema as json`)
  .option('-f, --from <from>', 'source space id')
  .option('--fi, --filter <filter>', 'glob filter to apply to the components before pushing')
  .option('--sf, --separate-files', 'Read from separate files instead of consolidated files')
  .option('--su, --suffix <suffix>', 'Suffix to add to the component name')

  .action(async (componentName: string | undefined, options: PushComponentsOptions) => {
    konsola.title(` ${commands.COMPONENTS} `, colorPalette.COMPONENTS, componentName ? `Pushing component ${componentName}...` : 'Pushing components...');
    // Global options
    const verbose = program.opts().verbose;
    const { space, path } = componentsCommand.opts();

    const { from, filter } = options;

    // Check if the user is logged in
    const { state, initializeSession } = session();
    await initializeSession();

    if (!requireAuthentication(state, verbose)) {
      return;
    }

    // Check if the space is provided
    if (!space) {
      handleError(new CommandError(`Please provide the target space as argument --space TARGET_SPACE_ID.`), verbose);
      return;
    }

    if (!from) {
      // If no source space is provided, use the target space as source
      options.from = space;
    }

    konsola.info(`Attempting to push components ${chalk.bold('from')} space ${chalk.hex(colorPalette.COMPONENTS)(options.from)} ${chalk.bold('to')} ${chalk.hex(colorPalette.COMPONENTS)(space)}`);
    konsola.br();

    const { password, region } = state;

    let requestCount = 0;

    mapiClient({
      token: password,
      region,
      onRequest: (_request) => {
        requestCount++;
      },
    });

    try {
      const spaceState: SpaceDataState = {
        local: await readComponentsFiles({
          ...options,
          path,
          space,
        }),
        target: {
          components: new Map(),
          groups: new Map(),
          tags: new Map(),
          presets: new Map(),
        },
      };

      // Target space data
      const promises = [
        fetchComponents(space),
        fetchComponentGroups(space),
        fetchComponentPresets(space),
        fetchComponentInternalTags(space),
      ];
      const [components, groups, presets, internalTags] = await Promise.all(promises);

      if (components) {
        (components as SpaceComponent[]).forEach((component) => {
          spaceState.target.components.set(component.name, component);
        });
      }

      if (groups) {
        (groups as SpaceComponentGroup[]).forEach((group) => {
          spaceState.target.groups.set(group.name, group);
        });
      }

      if (presets) {
        (presets as SpaceComponentPreset[]).forEach((preset) => {
          spaceState.target.presets.set(preset.name, preset);
        });
      }

      if (internalTags) {
        (internalTags as SpaceComponentInternalTag[]).forEach((tag) => {
          spaceState.target.tags.set(tag.name, tag);
        });
      }

      // If componentName is provided, filter space data to only include related resources
      if (componentName) {
        spaceState.local = filterSpaceDataByComponent(spaceState.local, componentName);
        if (!spaceState.local.components.length) {
          handleError(new CommandError(`Component "${componentName}" not found.`), verbose);
          return;
        }
      }
      // If filter pattern is provided, filter space data to match the pattern
      else if (filter) {
        spaceState.local = filterSpaceDataByPattern(spaceState.local, filter);
        if (!spaceState.local.components.length) {
          handleError(new CommandError(`No components found matching pattern "${filter}".`), verbose);
          return;
        }
        konsola.info(`Filter applied: ${filter}`);
      }

      if (!spaceState.local.components.length) {
        konsola.warn('No components found. Please make sure you have pulled the components first.');
        return;
      }

      const results = {
        successful: [] as string[],
        failed: [] as Array<{ name: string; error: unknown }>,
      };

      // Use optimized graph-based dependency resolution with colocated target data
      konsola.info('Using graph-based dependency resolution');
      const graphResults = await pushWithDependencyGraph(space, spaceState, 5);
      results.successful.push(...graphResults.successful);
      results.failed.push(...graphResults.failed);

      if (results.failed.length > 0) {
        if (!verbose) {
          konsola.br();
          konsola.info('For more information about the error, run the command with the `--verbose` flag');
        }
        else {
          results.failed.forEach((failed) => {
            handleError(failed.error as Error, verbose);
          });
        }
      }
      console.log(`${requestCount} requests made`);
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
  });
