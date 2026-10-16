import type { Command } from "commander";
import chalk from "chalk";

import type { MigrationsGenerateOptions } from "./constants";
import { colorPalette, commands } from "../../../constants";
import { CommandError, handleError, requireAuthentication } from "../../../utils";
import { session } from "../../../session";
import { fetchComponent, fetchComponents } from "../../../commands/components";
import { migrationsCommand } from "../command";
import { generateMigration } from "./actions";
import { displayPath, writeContentMigration } from "../content-migrations";
import { getUI } from "../../../lib/ui";
import { getLogger } from "../../../lib/logger/logger";
import { isFile, sanitizeFilename } from "../../../utils/filesystem";

const generateCmd = migrationsCommand
  .command("generate [componentName]")
  .description("Generate a migration file")
  .option(
    "--su, --suffix <suffix>",
    "suffix to add to the file name (e.g. {component-name}.<suffix>.js, or <timestamp>-{component-name}-<suffix>.ts with --schema)",
  )
  .option("-s, --space <space>", "space ID")
  .option(
    "--schema <entry-file>",
    "schema entry file; generates a typed defineMigration file and its .before.ts snapshot instead of a .js migration",
  )
  .option("--no-before", "skip the .before.ts schema snapshot next to the migration")
  .option("--legacy", "generate a .js migration for `migrations run` even when --schema is set");

generateCmd.action(
  async (
    componentName: string | undefined,
    options: MigrationsGenerateOptions,
    command: Command,
  ) => {
    const ui = getUI();
    const logger = getLogger();

    ui.title(
      `${commands.MIGRATIONS}`,
      colorPalette.MIGRATIONS,
      componentName
        ? `Generating migration for component ${componentName}...`
        : "Generating migrations...",
    );

    const { space, path, verbose } = command.optsWithGlobals();
    const { suffix, schema, legacy, before } = options;
    const schemaEntry = legacy ? undefined : schema;

    logger.info("Migration generation started", {
      componentName,
      space,
      suffix,
    });

    if (!componentName) {
      handleError(
        new CommandError(
          `Please provide the component name as argument ${chalk.hex(colorPalette.MIGRATIONS)("storyblok migrations generate YOUR_COMPONENT_NAME.")}`,
        ),
        verbose,
      );
      return;
    }

    if (suffix && sanitizeFilename(suffix) !== suffix) {
      handleError(
        new CommandError(
          `Invalid suffix "${suffix}". The suffix becomes part of the file name, so it cannot contain path separators or characters that are not allowed in file names.`,
        ),
        verbose,
      );
      return;
    }

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

    if (schemaEntry && !(await isFile(schemaEntry))) {
      handleError(
        new CommandError(`Schema entry file not found or not a file: ${schemaEntry}`),
        verbose,
      );
      return;
    }
    const schemaOnlyFlags = [...(legacy ? ["--legacy"] : []), ...(before ? [] : ["--no-before"])];
    if (!schema && schemaOnlyFlags.length > 0) {
      ui.warn(`${schemaOnlyFlags.join(" and ")} only apply together with --schema.`);
    } else if (legacy && !before) {
      ui.warn("--no-before has no effect with --legacy.");
    }

    const spinner = ui.createSpinner(`Generating migration for component ${componentName}...`);
    try {
      const components = schemaEntry && before ? await fetchComponents(space) : undefined;
      const component = components
        ? components.find((candidate) => candidate.name === componentName)
        : await fetchComponent(space, componentName);

      if (!component) {
        spinner.failed(
          `Failed to fetch component ${componentName}. Make sure the component exists in your space.`,
        );
        handleError(new CommandError(`No component found with name "${componentName}"`), verbose);
        return;
      }

      const written = schemaEntry
        ? await writeContentMigration({
            path,
            space,
            name: suffix ? `${component.name}-${suffix}` : component.name,
            schemaEntry,
            ops: [],
            before: components ? { components, blocks: [component.name] } : undefined,
          })
        : { migrationPath: await generateMigration(space, path, component, suffix) };
      const [migrationPath, ...snapshotPaths] = [written.migrationPath, written.beforePath]
        .filter((file) => file !== undefined)
        .map(displayPath);

      spinner.succeed(
        `Migration generated for component ${chalk.hex(colorPalette.MIGRATIONS)(componentName)} - Completed in ${spinner.elapsedTime.toFixed(2)}ms`,
      );

      ui.ok(
        `You can find the migration file in ${chalk.hex(colorPalette.MIGRATIONS)(migrationPath)}`,
      );
      for (const snapshotPath of snapshotPaths) {
        ui.ok(`Schema snapshot: ${chalk.hex(colorPalette.MIGRATIONS)(snapshotPath)}`);
      }

      logger.info("Migration generation finished", {
        componentName: component.name,
        migrationPath,
        snapshotPaths,
        space,
        suffix,
      });
    } catch (error) {
      spinner.failed(`Failed to generate migration for component ${componentName}`);
      handleError(error as Error, verbose);
    }
  },
);
