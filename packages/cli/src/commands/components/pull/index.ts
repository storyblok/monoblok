import type { PullComponentsOptions } from "./constants";
import type { Command } from "commander";

import { colorPalette, commands, directories } from "../../../constants";
import { CommandError, handleError, requireAuthentication } from "../../../utils";
import { session } from "../../../session";
import {
  fetchComponent,
  fetchComponentGroups,
  fetchComponentInternalTags,
  fetchComponentPresets,
  fetchComponents,
  saveComponentsToFiles,
} from "../actions";
import { componentsCommand } from "../command";
import chalk from "chalk";
import { isAbsolute, join, relative } from "pathe";
import { resolveCommandPath } from "../../../utils/filesystem";
import { DEFAULT_COMPONENTS_FILENAME } from "../constants";
import { getUI } from "../../../lib/ui";
import { getLogger } from "../../../lib/logger/logger";
import { filterSpaceData, resolveGroupSelector, resolveTagSelector } from "../utils";

const pullCmd = componentsCommand
  .command("pull [componentName]")
  .option("-f, --filename <filename>", "custom name to be used in file(s) name instead of space id")
  .option("--sf, --separate-files", "Argument to create a single file for each component")
  .option(
    "--su, --suffix <suffix>",
    "suffix to add to the file name (e.g. components.<suffix>.json)",
  )
  .option("-s, --space <space>", "space ID")
  .option("--fi, --filter <filter>", "glob pattern to select components by name")
  .option(
    "--gr, --group <group>",
    'component group to select by name (e.g. "Checkout"), or by a slash-separated path of nested group names to disambiguate (e.g. "Checkout/Payment"). Repeatable, includes descendant groups',
    (value: string, previous: string[] = []) => [...previous, value],
  )
  .option(
    "--tg, --tag <tag>",
    "component tag name (repeatable, comma-separated)",
    (value: string, previous: string[] = []) => [
      ...previous,
      ...value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    ],
  )
  .description(
    `Download your space's components schema as json. Optionally specify a component name to pull a single component.`,
  );

pullCmd.action(
  async (componentName: string | undefined, options: PullComponentsOptions, command: Command) => {
    const ui = getUI();
    const logger = getLogger();

    ui.title(
      `${commands.COMPONENTS}`,
      colorPalette.COMPONENTS,
      componentName ? `Pulling component ${componentName}...` : "Pulling components...",
    );

    const { space, path, verbose } = command.optsWithGlobals();
    const { separateFiles = false, suffix, filename, filter, group, tag } = options;

    // Use default filename when not provided
    const actualFilename = filename ?? DEFAULT_COMPONENTS_FILENAME;
    // `--path` overrides remain command-scoped; fallback keeps the historic .storyblok output.
    const componentsOutputDir = resolveCommandPath(directories.components, space, path);

    const { state } = session();

    if (!requireAuthentication(state, verbose)) {
      return;
    }
    if (!space) {
      handleError(
        new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`),
        verbose,
      );
      return;
    }

    logger.info("Pulling components started", { space, componentName });

    // Create progress bars for each resource type (pad titles for alignment)
    const pad = "Components".length;
    const barGroups = ui.createProgressBar({ title: "Groups".padEnd(pad) });
    const barPresets = ui.createProgressBar({ title: "Presets".padEnd(pad) });
    const barTags = ui.createProgressBar({ title: "Tags".padEnd(pad) });
    const barComponents = ui.createProgressBar({ title: "Components" });

    // Each fetch is a single API call, so total is 1 per bar
    barGroups.setTotal(1);
    barPresets.setTotal(1);
    barTags.setTotal(1);
    barComponents.setTotal(1);

    try {
      // Fetch all resource types in parallel so errors surface atomically
      const componentsFetch = componentName
        ? fetchComponent(space, componentName).then((c) => (c ? [c] : undefined))
        : fetchComponents(space);

      const [groupsResult, presetsResult, tagsResult, componentsResult] = await Promise.all([
        fetchComponentGroups(space),
        fetchComponentPresets(space),
        fetchComponentInternalTags(space),
        componentsFetch,
      ]);

      let groups = groupsResult;
      logger.info("Fetched groups", { count: groups?.length ?? 0 });
      barGroups.increment();

      let presets = presetsResult;
      logger.info("Fetched presets", { count: presets?.length ?? 0 });
      barPresets.increment();

      let internalTags = tagsResult;
      logger.info("Fetched tags", { count: internalTags?.length ?? 0 });
      barTags.increment();

      let components;

      if (componentName) {
        if (!componentsResult || componentsResult.length === 0) {
          barComponents.stop();
          ui.stopAllProgressBars();
          handleError(new CommandError(`No component found with name "${componentName}"`), verbose);
          return;
        }
        components = componentsResult;
      } else {
        if (!componentsResult || componentsResult.length === 0) {
          barComponents.stop();
          ui.stopAllProgressBars();
          handleError(new CommandError(`No components found in the space ${space}`), verbose);
          return;
        }
        components = componentsResult;

        const hasSelectors =
          Boolean(filter) || (group && group.length > 0) || (tag && tag.length > 0);
        if (hasSelectors) {
          const groupUuids =
            group && group.length > 0
              ? new Set<string>(group.flatMap((g) => [...resolveGroupSelector(groups || [], g)]))
              : undefined;
          const tagIds =
            tag && tag.length > 0 ? resolveTagSelector(internalTags || [], tag) : undefined;

          const filtered = filterSpaceData(
            {
              components,
              groups: groups || [],
              presets: presets || [],
              internalTags: internalTags || [],
              datasources: [],
            },
            { filter, groupUuids, tagIds },
          );
          if (filtered.components.length === 0) {
            barComponents.stop();
            ui.stopAllProgressBars();
            ui.warn("No components found matching the given selectors.");
            return;
          }
          components = filtered.components;
          groups = filtered.groups;
          presets = filtered.presets;
          internalTags = filtered.internalTags;
        }
      }
      logger.info("Fetched components", { count: components.length });
      barComponents.increment();

      barGroups.stop();
      barPresets.stop();
      barTags.stop();
      barComponents.stop();
      ui.stopAllProgressBars();

      await saveComponentsToFiles(
        space,
        {
          components,
          groups: groups || [],
          presets: presets || [],
          internalTags: internalTags || [],
          datasources: [],
        },
        { ...options, path, separateFiles: separateFiles || !!componentName },
      );
      ui.br();
      if (separateFiles) {
        if (filename && filename !== DEFAULT_COMPONENTS_FILENAME) {
          ui.warn(`The --filename option is ignored when using --separate-files`);
        }
        const filePath = `${componentsOutputDir}/`;
        // Only show relative path if the base path wasn't absolute
        const displayPath =
          path && isAbsolute(path) ? filePath : `${relative(process.cwd(), componentsOutputDir)}/`;

        ui.ok(
          `Components downloaded successfully to ${chalk.hex(colorPalette.PRIMARY)(displayPath)}`,
        );
      } else if (componentName) {
        const fileName = suffix ? `${actualFilename}.${suffix}.json` : `${componentName}.json`;
        const filePath = join(componentsOutputDir, fileName);
        // Only show relative path if the base path wasn't absolute
        const displayPath = path && isAbsolute(path) ? filePath : relative(process.cwd(), filePath);
        ui.ok(
          `Component ${chalk.hex(colorPalette.PRIMARY)(componentName)} downloaded successfully in ${chalk.hex(colorPalette.PRIMARY)(displayPath)}`,
        );
      } else {
        const fileName = suffix ? `${actualFilename}.${suffix}.json` : `${actualFilename}.json`;
        const filePath = join(componentsOutputDir, fileName);
        // Only show relative path if the base path wasn't absolute
        const displayPath = path && isAbsolute(path) ? filePath : relative(process.cwd(), filePath);

        ui.ok(
          `Components downloaded successfully to ${chalk.hex(colorPalette.PRIMARY)(displayPath)}`,
        );
      }
      ui.br();
    } catch (error) {
      barGroups.stop();
      barPresets.stop();
      barTags.stop();
      barComponents.stop();
      ui.stopAllProgressBars();
      ui.br();
      handleError(error as Error, verbose);
    } finally {
      logger.info("Pulling components finished", { space, componentName });
    }
  },
);
