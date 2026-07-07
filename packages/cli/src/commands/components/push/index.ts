import type { PushComponentsOptions } from './constants';
import type { Command } from 'commander';

import { colorPalette, commands } from '../../../constants';
import { CommandError, handleError, requireAuthentication } from '../../../utils';
import { session } from '../../../session';
import { deleteComponentPreset, readComponentsFiles } from './actions';
import { componentsCommand } from '../command';
import { filterSpaceData, filterSpaceDataByComponent, resolveGroupSelector, resolveTagSelector } from './utils';
import { pushWithDependencyGraph } from './graph-operations';
import chalk from 'chalk';
import { getMapiClient } from '../../../api';
import { fetchComponentGroups, fetchComponentInternalTags, fetchComponentPresets, fetchComponents } from '../actions';
import type { Component, ComponentFolder, InternalTag, Preset, SpaceComponentsData, SpaceComponentsDataState } from '../constants';
import { getUI } from '../../../utils/ui';
import { getLogger } from '../../../lib/logger/logger';

const pushCmd = componentsCommand
  .command('push [componentName]')
  .description(`Push your space's components schema as json`)
  .option('-f, --from <from>', 'source space id')
  .option('--fi, --filter <filter>', 'glob filter to apply to the components before pushing')
  .option('--gr, --group <group>', 'component group to select by name (e.g. "Checkout"), or by a slash-separated path of nested group names to disambiguate (e.g. "Checkout/Payment"). Repeatable, includes descendant groups', (value: string, previous: string[] = []) => [...previous, value])
  .option('--tg, --tag <tag>', 'component tag name (repeatable, comma-separated)', (value: string, previous: string[] = []) => [...previous, ...value.split(',').map(v => v.trim()).filter(Boolean)])
  .option('--sf, --separate-files', 'Read from separate files instead of consolidated files', false)
  .option('--su, --suffix <suffix>', 'Load only files matching *.<suffix>.json (e.g. components.dev.json)')
  .option('-s, --space <space>', 'space ID');

pushCmd
  .action(async (componentName: string | undefined, options: PushComponentsOptions, command: Command) => {
    const ui = getUI();
    const logger = getLogger();

    ui.title(`${commands.COMPONENTS}`, colorPalette.COMPONENTS, componentName ? `Pushing component ${componentName}...` : 'Pushing components...');

    const { space, path, verbose } = command.optsWithGlobals();

    const { filter, group, tag } = options;
    const fromSpace = options.from || space;

    // Check if the user is logged in
    const { state } = session();

    if (!requireAuthentication(state, verbose)) {
      return;
    }

    // Check if the space is provided
    if (!space) {
      handleError(new CommandError(`Please provide the target space as argument --space TARGET_SPACE_ID.`), verbose);
      return;
    }

    logger.info('Pushing components started', { space, fromSpace, componentName });

    ui.info(`Attempting to push components ${chalk.bold('from')} space ${chalk.hex(colorPalette.COMPONENTS)(fromSpace)} ${chalk.bold('to')} ${chalk.hex(colorPalette.COMPONENTS)(space)}`);
    ui.br();

    let requestCount = 0;

    const client = getMapiClient();

    client.interceptors.request.use((config) => {
      requestCount++;
      return config;
    });

    try {
      // Read components data from source space (from option or target space)
      const componentsData = await readComponentsFiles({
        ...options,
        path,
        from: fromSpace,
      });

      // Combine into the expected structure
      // Note: Datasources are not managed by the components push command
      const localData: SpaceComponentsData = {
        ...componentsData,
        datasources: [],
      };

      const spaceState: SpaceComponentsDataState = {
        local: localData,
        target: {
          components: new Map(),
          groups: new Map(),
          tags: new Map(),
          presets: new Map(),
          datasources: new Map(),
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
        (components as Component[]).forEach((component) => {
          spaceState.target.components.set(component.name, component);
        });
      }

      if (groups) {
        (groups as ComponentFolder[]).forEach((group) => {
          spaceState.target.groups.set(group.name, group);
        });
      }

      if (presets) {
        (presets as Preset[]).forEach((preset) => {
          // Find the parent component for this nested preset resource
          const targetComponent = (components as Component[])?.find(c => c.id === preset.component_id);
          if (targetComponent) {
            // Store presets using hierarchical key: component.name:preset.name (parent:child)
            // This reflects the nested resource relationship where presets are scoped to components
            const compositeKey = `${targetComponent.name}:${preset.name}`;
            spaceState.target.presets.set(compositeKey, preset);
          }
        });
      }

      if (internalTags) {
        (internalTags as InternalTag[]).forEach((tag) => {
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
      // If a filter, group, or tag selector is provided, filter space data to match the selectors
      else if (filter || (group && group.length > 0) || (tag && tag.length > 0)) {
        const groupUuids = group && group.length > 0
          ? new Set<string>(group.flatMap(g => [...resolveGroupSelector(spaceState.local.groups, g)]))
          : undefined;
        const tagIds = tag && tag.length > 0
          ? resolveTagSelector(spaceState.local.internalTags, tag)
          : undefined;

        spaceState.local = filterSpaceData(spaceState.local, { filter, groupUuids, tagIds });
        if (!spaceState.local.components.length) {
          handleError(new CommandError('No components found matching the given selectors.'), verbose);
          return;
        }
        const applied = [filter && `filter ${filter}`, group?.length && `group ${group.join(', ')}`, tag?.length && `tag ${tag.join(', ')}`].filter(Boolean).join('; ');
        ui.info(`Selectors applied: ${applied}`);
      }

      if (!spaceState.local.components.length) {
        ui.warn('No components found. Please make sure you have pulled the components first.');
        return;
      }

      const results = {
        successful: [] as string[],
        failed: [] as Array<{ name: string; error: unknown }>,
      };

      // Build local preset keys BEFORE graph processing (which mutates component_id references)
      const localComponentById = new Map(spaceState.local.components.map(c => [c.id, c.name]));
      const localPresetKeys = new Set<string>();
      for (const preset of spaceState.local.presets) {
        const componentName = localComponentById.get(preset.component_id);
        if (componentName) {
          localPresetKeys.add(`${componentName}:${preset.name}`);
        }
      }

      // Use optimized graph-based dependency resolution with colocated target data
      ui.info('Using graph-based dependency resolution');
      const graphResults = await pushWithDependencyGraph(space, spaceState);
      results.successful.push(...graphResults.successful);
      results.failed.push(...graphResults.failed);

      // Reconcile presets: delete stale presets only for components that were pushed successfully
      const successfulNames = new Set(results.successful);
      for (const [compositeKey, targetPreset] of spaceState.target.presets) {
        const separatorIndex = compositeKey.indexOf(':');
        const componentName = compositeKey.substring(0, separatorIndex);

        if (successfulNames.has(componentName) && !localPresetKeys.has(compositeKey)) {
          try {
            await deleteComponentPreset(space, targetPreset.id);
            ui.info(`Deleted stale preset: ${chalk.hex(colorPalette.PRESETS)(compositeKey)}`);
          }
          catch (error) {
            results.failed.push({ name: compositeKey, error });
          }
        }
      }

      if (results.failed.length > 0) {
        if (!verbose) {
          ui.br();
          ui.info('For more information about the error, run the command with the `--verbose` flag');
        }
        else {
          results.failed.forEach((failed) => {
            handleError(failed.error as Error, verbose);
          });
        }
      }
      console.log(`${requestCount} requests made`);

      // Check if components reference datasources and inform user
      const referencedDatasources = new Set<string>();
      spaceState.local.components.forEach((component) => {
        if (component.schema) {
          const fields = JSON.stringify(component.schema);
          const datasourceMatches = fields.match(/"datasource_slug"\s*:\s*"([^"]+)"/g);
          if (datasourceMatches) {
            datasourceMatches.forEach((match) => {
              const slug = match.match(/"([^"]+)"$/)?.[1];
              if (slug) {
                referencedDatasources.add(slug);
              }
            });
          }
        }
      });

      if (referencedDatasources.size > 0) {
        ui.br();
        ui.info(`Components reference datasources: ${chalk.yellow(Array.from(referencedDatasources).join(', '))}`);
        ui.info(`To manage datasources, use: ${chalk.cyan('storyblok datasources push')}`);
      }
    }
    catch (error) {
      handleError(error as Error, verbose);
    }
    finally {
      logger.info('Pushing components finished', { space, fromSpace, componentName });
    }
  });
